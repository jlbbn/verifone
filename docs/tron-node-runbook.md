# Runbook operativo — nodo y hot wallet TRON

## Alcance y principio de seguridad

El FullNode es infraestructura de lectura/transmisión y **no contiene llaves**.
La llave de la hot wallet vive únicamente en el host del firmador. Banxico Plus
solo prepara una intención y nunca firma localmente.

## Estados de operación

1. **Preparado**: código disponible, sin infraestructura. Ambos candados en `false`.
2. **Lectura**: FullNode sincronizado; saldos y conciliación activos; firma apagada.
3. **Nile**: firmador con wallet exclusivamente testnet; pruebas E2E sin fondos reales.
4. **Mainnet pausado**: llave productiva importada en el firmador, ambos candados apagados.
5. **Mainnet activo**: aprobación formal, límites configurados y doble candado activo.

No se salta del estado 1 al 5.

## Checklist de puesta en marcha

- [ ] Host cumple al menos 8 CPU, 16 GB RAM, 3 TB SSD y 100 Mbps.
- [ ] Release y SHA-256 comparados con GitHub oficial.
- [ ] Snapshot proviene de fuente aprobada y su SHA-256 fue verificado.
- [ ] RPC y métricas solo son accesibles desde la VPC.
- [ ] App y firmador tienen el mismo `TRON_FULL_HOST` privado y el mismo
  `TRON_APPROVED_NODE_ORIGIN`; no hay endpoint público/default.
- [ ] App y firmador reportan el mismo `TRON_NETWORK` y contrato USDT; Nile usa
  wallet y archivo de estado exclusivos, nunca reutilizados en mainnet.
- [ ] App y firmador validan que el bloque génesis del RPC coincide con el perfil;
  una etiqueta `nile` sin identidad de cadena Nile no cuenta como saludable.
- [ ] Firewall de DigitalOcean replica el allowlist de UFW.
- [ ] UFW ya estaba activo con `deny incoming` antes de ejecutar instaladores.
- [ ] Reglas UFW prioritarias fueron revisadas y se autorizó
  `--apply-firewall-policy`; RPC público fue probado como inaccesible.
- [ ] Reloj sincronizado; nodo dentro de 180 segundos del head y con peers.
- [ ] Firmador en host separado, mTLS vigente, HMAC rotado y replay tests aprobados.
- [ ] La llave local heredada fue retirada del proceso de Banxico Plus.
- [ ] Límites de app y firmador coinciden; el firmador es igual o más restrictivo.
- [ ] Reserva TRX comprobada; hot wallet solo contiene saldo operativo.
- [ ] Conciliación verifica contrato, destinatario y monto antes de confirmar.
- [ ] Pruebas adversariales del firmador rechazan payload, owner, contrato, fee,
  expiración o txid alterados por el nodo antes de firmar.
- [ ] `npm run test:tron` pasa offline con ambos candados apagados.
- [ ] Hook de alertas aprobado, responsable asignado y prueba de entrega confirmada.

## Certificados y alertas

- La CA privada permanece offline. El host recibe solo su certificado servidor,
  llave servidor y CA de clientes.
- La llave TLS del firmador es `root:tron-signer` modo 0640; certificados públicos
  pueden ser 0644. Renovar antes del vencimiento y reiniciar con escrituras apagadas.
- `TRON_ALERT_HOOK_PATH` debe apuntar a un adaptador local aprobado (PagerDuty,
  correo corporativo u otro canal). El instalador no acepta un nodo sin hook.
- Ejecutar `sudo /usr/local/sbin/tron-node-test-alert`; el script cambia al
  usuario restringido `tron`. Obtener confirmación humana de recepción antes de
  habilitar el timer o cualquier escritura.

## Pausa de emergencia

Ejecutar en este orden:

1. Cambiar `TRON_WALLET_WRITES_ENABLED=false` en la aplicación y reiniciarla.
2. Cambiar `TRON_SIGNER_WRITES_ENABLED=false` en el host firmador y reiniciarlo.
3. Confirmar que `/api/admin/tron/status` muestra pagos bloqueados.
4. Revocar el certificado cliente de la app si existe sospecha de compromiso.
5. No borrar logs, estado idempotente ni registros de dispersión.
6. Si la llave puede estar expuesta, mover el saldo a la wallet de resguardo mediante
   el procedimiento offline aprobado; no reutilizar la llave.

El FullNode puede permanecer activo durante una pausa: no puede firmar por sí solo.

## Incidentes

### Nodo atrasado o sin peers

- Mantener escrituras apagadas.
- Revisar `systemctl status tron-node`, `journalctl -u tron-node` y el healthcheck.
- Verificar disco, reloj, red P2P y allowlists.
- Si la base está corrupta, detener el servicio y rebootstrappear desde snapshot.

### Solicitud pendiente sin txid

- No crear otra solicitud con una clave distinta.
- Consultar el estado idempotente del firmador y logs por `requestId`.
- Reintentar únicamente con la misma clave de idempotencia después de establecer si
  hubo broadcast. Si no puede determinarse, escalar a revisión manual.

### Transacción no coincide con la intención

- El sistema la marca `ONCHAIN_INTENT_MISMATCH`.
- Pausar ambos candados inmediatamente.
- Conservar evidencia on-chain, logs y registro de auditoría.

### Firmante mainnet no responde su healthcheck (15-sep-2026)

**Síntoma:** `curl -sk https://10.30.0.3:9443/health` desde el propio FullNode
mainnet (10.30.0.2, misma VPC `tron-mainnet-vpc`) devuelve *connection refused*
de forma instantánea (<5ms), no timeout. SSH al firmante con la llave admin
derivada también es rechazado (esperado por diseño de la ceremonia).

**Diagnóstico remoto (sin acceso SSH al firmante, solo evidencia externa):**
- El droplet `tron-signer-mainnet` (165.227.191.242 / 10.30.0.3) y su VPC
  `tron-mainnet-vpc` (10.30.0.0/20) fueron recreados el 2026-09-07 — distintos
  de los IDs/IPs documentados en `.agents/memory/tron-mainnet-node.md` (ago 2026).
  Imagen base: `ubuntu-24-04-x64` estándar, no una imagen pre-provisionada.
- `infra_logs` (tabla que recibe el journal reenviado por el shipper del host)
  no tiene ninguna entrada de `tron-signer-mainnet` ni `tron-mainnet-lite`
  posterior a esa recreación; solo quedan logs de una encarnación anterior del
  droplet (24-ago-2026, incluyendo un `signer_started` legítimo ese día).
- Ping a 10.30.0.3 responde en ~1-3ms (host arriba, ruta de red intacta). El
  puerto 22 acepta la conexión TCP y solo rechaza la autenticación (servicio
  sshd corriendo). El puerto 9443 rechaza la conexión TCP instantáneamente —
  patrón típico de "nada escuchando en ese puerto", no de un DROP de firewall.
- Los firewalls de nube de DigitalOcean `tron-mainnet-node-fw` y
  `tron-mainnet-signer-fw` existen pero tienen `droplet_ids: []` (no están
  adjuntos a ningún droplet); por contraste, `tron-nile-signer-fw` sí está
  adjunto a su droplet. Esto es inconsistente con la ceremonia documentada y
  sugiere que el rearmado de infraestructura del 7-sep quedó a medias.
- No existe *VPC peering* entre `banxico-plus-vpc` (10.10.0.0/20, donde vive
  la app) y `tron-mainnet-vpc` (10.30.0.0/20): la app no tiene ruta privada
  al firmante ni al nodo aunque el healthcheck funcionara.

**Conclusión más probable:** tras recrear el droplet del firmante mainnet el
7-sep-2026, la ceremonia de aprovisionamiento
(`scripts/infra/tron-signer/mainnet/provision-mainnet-signer.sh` +
`install.sh --execute` + `systemctl start tron-signer`) nunca se completó en
el host nuevo — por eso no hay wallet/HMAC nuevos, no hay servicio escuchando
en 9443 y no hay logs reenviados. No se puede confirmar esto con certeza total
sin acceso SSH del tenedor de la ceremonia al host.

**Acción requerida (solo el tenedor de acceso del firmante mainnet):**
1. Confirmar `systemctl status tron-signer` en el host; si no existe o está
   inactivo, ejecutar la ceremonia de aprovisionamiento completa desde cero
   (nueva wallet, nuevo HMAC — el material anterior, si existió, vivía solo en
   el droplet destruido y no es recuperable).
2. Adjuntar `tron-mainnet-node-fw` y `tron-mainnet-signer-fw` a sus droplets
   correspondientes en DigitalOcean (o recrearlos con el allowlist angosto de
   `ufw.rules.example`, no `10.30.0.0/20` completo para 9443) — no se tocaron
   en este diagnóstico por tratarse de una infraestructura de custodia de
   llave activa.
3. Resolver la falta de VPC peering entre `banxico-plus-vpc` y
   `tron-mainnet-vpc` (o mover la app a la misma VPC) antes de habilitar
   escrituras, o la app tampoco podrá alcanzar el firmante en producción.
4. Re-probar `curl -sk https://10.30.0.3:9443/health` desde el FullNode y
   confirmar el payload `SignerHealth` esperado.

## Actualizaciones

1. Leer notas del release y alertas de seguridad.
2. Probar el release en un nodo no productivo.
3. Fijar URL y SHA-256 del candidato.
4. Crear backup de configuración; nunca copiar en caliente la base.
5. Ejecutar `upgrade.sh` en ventana de mantenimiento.
6. El script restaura el JAR anterior si falla el healthcheck.

## Recuperación

- FullNode: reconstruir desde release fijado + snapshot verificado.
- Firmador: restaurar configuración, certificados y estado idempotente cifrado.
- Wallet: usar el material de custodia offline; nunca el backup del FullNode.
- Aplicación: restaurar PostgreSQL y conciliar cada txid con contrato/destino/monto.

## Hallazgo real (2026-09-15): direcciones placeholder sin actividad en cadena

- `PLATFORM_TRON_ADDRESS` (configurada, ahora retirada de `.replit`):
  `THRW3adKKoqrH5Cy31JvWdGJd3S1XNscGX`.
- Dirección derivada matemáticamente de `PLATFORM_TRON_PRIVATE_KEY` (secret
  actual): `TD99cNkHynEmTZzD6EJqmTDGxu64kvHH1b`.
- Las dos direcciones son distintas entre sí — el código de la app nunca
  verifica esta correspondencia, solo confía en la variable de entorno
  (`server/crypto/tron-client.ts`, línea 36).
- Verificación en cadena contra el nodo mainnet (`/wallet/getaccount`):
  **ambas direcciones devuelven `{}`** — ninguna existe en la cadena, ninguna
  se ha activado nunca. No hay ninguna transacción real asociada a ellas.
- Confirmado también en PostgreSQL: `hot_wallet_dispersions` tiene 0 filas
  (ninguna dispersión real ejecutada jamás); `tron_deposit_credits`,
  `tron_deposit_declarations` y `crypto_withdrawal_requests` solo contienen
  datos de prueba (txids `faketxid_...`/`dupe_...`, direcciones
  `TFakeFromAddress...`/`TXXXX...` placeholder).
- `server/crypto/tron-client.ts` usa `PLATFORM_TRON_ADDRESS` como owner por
  defecto en las líneas 185, 470 y 475. Con la variable ahora vacía (retirada
  de `.replit`), esas rutas fallarán o devolverán "(not configured)" hasta que
  se fije la dirección real tras la ceremonia mainnet — es el comportamiento
  esperado durante esta ventana, no un bug a corregir por separado.
- Conclusión: no hay nada que reconciliar retroactivamente — ambas
  direcciones son restos de configuración/prueba sin fondos ni historial.
  `PLATFORM_TRON_PRIVATE_KEY` se eliminará de Secrets por completo cuando
  la ceremonia mainnet del firmante (ver README de
  `scripts/infra/tron-signer/`) genere la dirección de plataforma
  definitiva; la app no debe volver a tener una llave privada TRON propia.
  `PLATFORM_TRON_ADDRESS` se fijará entonces a esa dirección real. Ref. interna:
  task #135 (bloqueada hasta esa ceremonia).

## Checklist de activación mainnet del firmante

Condiciones obligatorias antes de poner `TRON_SIGNER_WRITES_ENABLED=true` en mainnet
(origen: revisión de arquitectura 2026-08-23, veredicto PASS condicionado):

1. `TRON_NODE_LITE=true` en el env del firmante cuando el nodo venga de snapshot
   lite (siempre, en esta operación). Semántica fail-closed: sin esa declaración,
   el cierre del génesis del nodo lite deja `healthy=false` y las escrituras
   bloqueadas. Diagnóstico típico: `genesisStatus=closed_lite_node` con
   `liteMode=false`.
2. Alerta compuesta del lado de la app: solo se considera sano el firmante si
   `/health` muestra SIMULTÁNEAMENTE `healthy=true`, `liteMode=true`,
   `genesisStatus=closed_lite_node`, `chainIdentityMethod=p2pVersion` y
   `p2pVersion=11111`. Cualquier otra combinación = no escribir + alertar.
3. Egress del firmante restringido por UFW OUTBOUND exclusivamente al nodo
   privado (IP:8090) además del deny incoming actual (regla a añadir en la
   ceremonia mainnet).
4. Contabilidad: una dispersión SOLO se marca liquidada con recibo on-chain
   SUCCESS + evento `Transfer` exacto (fuente, destino, contrato, monto
   atómico). El estado `broadcast` del firmante NO es liquidación. Re-verificar
   este consumo en la capa de la app durante el wiring mainnet.
5. Snapshot con checksum md5 verificado e imagen java-tron pinneada
   (GreatVoyage v4.8.2.1), aprovisionado por nosotros.
