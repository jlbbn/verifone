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