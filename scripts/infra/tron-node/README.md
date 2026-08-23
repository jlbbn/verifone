# Nodo TRON corporativo — paquete de aprovisionamiento

## Estado

Este directorio está **preparado pero no ejecutado**. No se creó infraestructura,
no se generaron llaves y no se movieron fondos.

La versión fijada es `GreatVoyage-v4.8.2.1` (31-jul-2026). El SHA-256 del JAR
x86_64 se tomó de los assets oficiales de GitHub y está fijado en el ejemplo.

## Requisitos oficiales actuales

| Perfil | CPU | RAM | SSD | Red |
|---|---:|---:|---:|---:|
| Mínimo FullNode | 8 cores | 16 GB | 3 TB | 100 Mbps |
| Recomendado | 16 cores | 32 GB | 3 TB+ | 100 Mbps |

El instalador **se niega** a modificar un servidor que no alcance el mínimo.
En x86_64 java-tron exige JDK 8; ARM64 exige JDK 17 y un JAR diferente.

## Puertos

| Puerto | Acceso |
|---|---|
| 18888 TCP/UDP | Público, P2P/discovery de TRON |
| 8090–8092 | Solo VPC, API HTTP |
| 50051/50061/50071 | Solo VPC, gRPC |
| 9527 | Solo VPC, métricas Prometheus |
| 8545 | Denegado; JSON-RPC deshabilitado |
| 22 | Solo CIDR administrativo aprobado |

java-tron escucha sus APIs en las interfaces del host; el aislamiento se aplica
en **DigitalOcean Cloud Firewall + UFW**. Nunca se debe publicar RPC en Internet.

## Uso posterior

```bash
cp infra/tron-node/tron-node.env.example infra/tron-node/tron-node.env
# Completar ADMIN_SSH_CIDR y TRON_RPC_ALLOWED_CIDR.
bash infra/tron-node/install.sh              # validación/dry-run
sudo bash infra/tron-node/install.sh --execute --apply-firewall-policy
```

La instalación no arranca el nodo. Para hacerlo se requiere además `--start` e
`I_UNDERSTAND_TRON_MAINNET=true`.

`--apply-firewall-policy` es una aceptación separada: inserta reglas prioritarias
que permiten RPC/métricas desde la VPC y deniegan esos puertos para cualquier
otro origen, incluso si el host tenía reglas permisivas más antiguas. Antes de
ejecutar se guarda la lista UFW existente en `/var/backups/tron-node/`.

## Arranque desde snapshot

Un sync desde génesis puede tardar semanas. El script de snapshot exige URL
HTTPS y SHA-256 aportado por el operador, valida antes de extraer, se niega si el
nodo está activo y conserva la base anterior para rollback.

La documentación oficial a veces publica MD5; para este paquete se exige además
un SHA-256 calculado y aprobado por el operador antes de ejecutar.

## Recuperación

La base del FullNode no contiene llaves y puede reconstruirse desde un snapshot
verificado. Los elementos que sí deben respaldarse son:

- configuración exacta y hashes del release;
- certificados mTLS (sin la CA privada online);
- estado del firmador y auditoría de Banxico Plus;
- runbook y lista de accesos.

No se realiza una copia “en caliente” de LevelDB/RocksDB. Para una copia
consistente se detiene el nodo o se reconstruye desde un snapshot verificado.

Scripts adicionales:

- `monitor.sh` + unidades `tron-node-health.*`: head/peers cada minuto y alerta en syslog.
- `backup.sh`: backup reproducible de configuración y hashes; excluye la base viva.
- `upgrade.sh`: actualización fijada por SHA-256 con healthcheck y rollback automático.
- `docs/tron-node-runbook.md`: puesta en marcha, pausa de emergencia e incidentes.