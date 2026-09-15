# Firmador TRON aislado

Este servicio es el único componente que puede recibir la llave privada de la
hot wallet. Banxico Plus se autentica con **mTLS + HMAC** y envía únicamente la
intención validada de transferencia.

## Estado de esta entrega

- Código y unidad systemd preparados.
- `TRON_SIGNER_WRITES_ENABLED=false` por defecto.
- No se generó ni importó ninguna llave.
- No se crearon certificados ni secretos.
- No se transmitió ninguna transacción.

## Controles

1. Rechaza clientes sin certificado firmado por la CA privada.
2. Verifica HMAC en tiempo constante, timestamp de 30 segundos y nonce anti-replay.
3. Fija un perfil completo de red y contrato. El default es `mainnet`; `nile`
   solo se acepta de forma explícita mediante `TRON_NETWORK=nile`.
4. Aplica límites propios por operación y día, independientes de la aplicación.
5. Verifica que la llave corresponda a la dirección pública configurada.
6. Decodifica la transacción sin firmar y exige coincidencia exacta de owner,
   contrato, selector, destino, monto atómico, fee, TAPOS y expiración.
7. Solo acepta el origen privado fijado simultáneamente en `TRON_FULL_HOST` y
   `TRON_APPROVED_NODE_ORIGIN`; no existe fallback a TronGrid.
8. Persiste resultados por clave de idempotencia antes de responder.
9. Mantiene la escritura cerrada hasta activar explícitamente el doble candado.
10. Liga el archivo de estado a una sola red y contrato; Nile debe usar una
    wallet y un `TRON_SIGNER_STATE_PATH` separados de mainnet.
11. Verifica la identidad de la cadena con el bloque génesis del perfil o, si el
    nodo es lite y cierra esa API, con el `p2pVersion` de la red.

## Aprovisionamiento posterior

1. Crear un host aislado en la misma red privada del nodo y de la aplicación.
2. Instalar la misma versión de Node usada por Banxico Plus y desplegar el repo.
3. Crear el usuario sin login `tron-signer` y `/var/lib/tron-signer` con modo 0700.
4. Emitir certificados servidor/cliente desde una CA privada guardada offline.
5. Copiar `tron-signer.env.example` a `tron-signer.env` en el host y completar
   IPs privadas, rutas TLS y límites con escrituras todavía apagadas.
6. Activar primero un baseline UFW `deny incoming`; reflejar el mismo allowlist
   en DigitalOcean Cloud Firewall.
6.1. Administración por Tailscale, no por IP pública: instalar Tailscale en el
     host (`curl -fsSL https://tailscale.com/install.sh | sh` y `tailscale up`)
     y dejar `ADMIN_SSH_TAILSCALE=true` (default). `install.sh` limita el 22 a
     la interfaz `tailscale0`, así que no depende de ninguna IP pública que se
     vuelva obsoleta. `ADMIN_SSH_CIDR` queda como fallback legado opcional —
     déjalo vacío salvo que necesites SSH por IP pública además de Tailscale.
7. Ejecutar `bash scripts/infra/tron-signer/install.sh` (dry-run) y después
   `sudo bash scripts/infra/tron-signer/install.sh --execute`.
8. Verificar que la llave TLS queda `root:tron-signer` modo 0640 y que el
   servicio solo escucha en la IP privada.
9. Mantener escrituras apagadas y probar `/health`.
10. Ejecutar pruebas con Nile antes de considerar mainnet.

Para el ensayo Nile, configurar `TRON_NETWORK=nile`, una dirección/llave
exclusivamente testnet y un archivo de estado exclusivo. Ambos candados
permanecen en `false` durante instalación y validación sin broadcast.

La llave nunca debe guardarse en Replit, el repositorio, el host de la app o el
nodo FullNode. La restauración y rotación requiere el procedimiento de
`docs/tron-node-runbook.md`.