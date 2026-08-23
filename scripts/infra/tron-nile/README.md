# TRON Nile Lite FullNode experimental

Este paquete es independiente de `infra/tron-node/`, que conserva requisitos
estrictos para mainnet. Nile sirve para validar operación, RPC privado y la
conexión futura con un firmador de prueba; **no contiene llaves**.

## Perfil desplegado

- Imagen oficial Nile:
  `tronnile/java-tron@sha256:aee489cb1949a05df2f9055970c67da76b8d56ad1011bb0d47b1fc3ce29716ae`
- Release publicado: `GreatVoyage-Nile-v4.8.2.1-PQ1-build1`
- Snapshot: `LiteFullNode_output-directory.tgz` de `database.nileex.io`
- Runtime experimental: 4 vCPU, 8 GB RAM, 160 GB SSD y 4 GB swap
- JVM: `-Xms2G -Xmx4G`, máximo 512 MB de memoria directa
- Contenedor: 6 GB RAM y 10 GB RAM+swap; el host conserva 2 GB de RAM

La documentación de Nile indica un mínimo de 8 vCPU, 16 GB RAM y 150 GB
libres. Este perfil está deliberadamente por debajo de CPU/RAM y no debe
considerarse apto para mainnet ni producción. Si entra en OOM/restart loop,
queda atrasado o no mantiene peers, se elimina en vez de escalarlo
silenciosamente.

## Aislamiento

| Puerto | Política |
|---|---|
| 18888 TCP/UDP | Público, P2P Nile |
| 8090–8092 | Solo VPC |
| 50051/50061/50071 | Solo VPC |
| 9527 | Solo VPC |
| 8545 | Denegado |
| 22 | CIDR administrativo aprobado o concesión temporal |

El firewall cloud y UFW deben aplicar la misma política. El RPC nunca se abre
a Internet. Para administración remota se usa un túnel SSH:

```bash
ssh -L 18090:127.0.0.1:8090 root@NILE_NODE
TRON_HTTP_URL=http://127.0.0.1:18090 bash scripts/infra/tron-nile/healthcheck.sh
```

## Bootstrap reproducible

El índice oficial `database.nileex.io` enlaza los archivos alojados en
`snapshots.nileex.io`. Nile publica MD5 para esos snapshots, no SHA-256. El
bootstrap:

1. exige HTTPS y el hostname/ruta exactos de snapshots Nile, sin redirects;
2. extrae en staging mientras calcula MD5 y SHA-256 del stream;
3. rechaza rutas absolutas, `..`, links y dispositivos;
4. exige el `Content-Length` esperado y limita el tamaño extraído a 120 GiB,
   conservando al menos 12 GiB libres;
5. elimina staging si el tamaño o MD5 oficial no coincide;
6. registra el SHA-256 calculado localmente para auditoría.

```bash
export NILE_SNAPSHOT_URL='https://snapshots.nileex.io/backupYYYYMMDD/LiteFullNode_output-directory.tgz'
export NILE_SNAPSHOT_MD5='32_HEX_PUBLICADO'
export NILE_SNAPSHOT_BYTES='CONTENT_LENGTH'
sudo -E bash scripts/infra/tron-nile/bootstrap-snapshot.sh
sudo -E bash scripts/infra/tron-nile/bootstrap-snapshot.sh --execute
```

El segundo comando instala la base pero no habilita firma. El servicio del nodo
se arranca por separado:

```bash
sudo install -d -m 0755 /opt/tron-nile
sudo install -m 0755 scripts/infra/tron-nile/healthcheck.sh /opt/tron-nile/
sudo install -m 0755 scripts/infra/tron-nile/bootstrap-snapshot.sh /opt/tron-nile/
sudo install -m 0755 scripts/infra/tron-nile/stream-extract.py /opt/tron-nile/
sudo install -m 0644 scripts/infra/tron-nile/tron-nile-node.service /etc/systemd/system/
sudo install -m 0644 scripts/infra/tron-nile/tron-nile-bootstrap.service /etc/systemd/system/
sudo install -m 0644 scripts/infra/tron-nile/tron-nile-health.service /etc/systemd/system/
sudo install -m 0644 scripts/infra/tron-nile/tron-nile-health.timer /etc/systemd/system/
sudo install -D -m 0600 scripts/infra/tron-nile/tron-nile-bootstrap.env.example /etc/tron-nile/bootstrap.env
# Reemplazar YYYYMMDD, MD5 y Content-Length por los datos actuales del índice Nile.
sudo systemctl daemon-reload
sudo systemctl start tron-nile-bootstrap
sudo systemctl enable --now tron-nile-node
sudo systemctl enable --now tron-nile-health.timer
sudo bash scripts/infra/tron-nile/healthcheck.sh
```

El timer no envía datos fuera del host: registra cada resultado en journald y
marca la unidad fallida si el head supera tres minutos o hay menos de tres
peers. Un canal externo de alertas se autoriza por separado.

## Base para el firmador

El siguiente estado útil es conectar un host **separado** de firma a la IP
privada `:8090`. Ese host tendrá wallet exclusivamente Nile, mTLS, HMAC,
anti-replay e idempotencia, con `TRON_SIGNER_WRITES_ENABLED=false` inicialmente.
No se instala una llave en este nodo y no se reutiliza ninguna llave en mainnet.
