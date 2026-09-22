tro---
name: TRON mainnet node ops
description: Lecciones del nodo mainnet Lite y el firmante mainnet en DigitalOcean (arranque, config, firewall)
---

## Snapshot mainnet Lite exige checkpoint v2
Los snapshots Lite oficiales de mainnet usan checkpoint v2; la config oficial (main_net_config.conf) trae `checkpoint.version = 2` comentado. Sin activarlo, el nodo sale con exit 255 a los ~9s.
**Why:** El contenedor java-tron NO imprime el error en stdout/journal — el motivo real (`CHECKPOINT_VERSION(-1)`) solo aparece en `logs/tron.log` dentro del directorio de logs montado.
**How to apply:** Ante un exit 255 silencioso del contenedor FullNode, mirar primero `<log-mount>/logs/tron.log`, no `docker logs`.

## Topología mainnet (ago 2026)
- Nodo: droplet `tron-mainnet-lite` 167.172.18.29 / 10.10.0.4 (VPC 10.10.0.0/20), disco local 160GB, imagen pinneada por sha256 (GreatVoyage-v4.8.2.1); entrypoint `/java-tron/bin/FullNode` confirmado igual que nile.
- Firmante: droplet `tron-signer-mainnet` 165.227.76.233 / 10.10.0.5; ceremonia propia (wallet+HMAC nacen en host, jamás salen); writes=false hasta pasar canario; key-id banxico-mainnet-v1; creds del cliente app en `/root/app-client-creds/` para el wiring.
- UFW nodo: 8090 SOLO desde 10.10.0.5 (firmante) y 10.10.0.2 (app); nada más de la VPC. Healthcheck usa 127.0.0.1.
- UFW firmante egreso: default deny; solo nodo:8090, DNS a resolvers DO (67.207.67.2/.3), 443 (envío de logs; riesgo residual aceptado por endpoint autoscale sin IP fija), NTP.
**How to apply:** Al depurar conectividad, recordar que el resto de la VPC NO alcanza el 8090 del nodo; agregar IPs explícitas, no rangos.

## Confirmado: mainnet es lite fullnode igual que Nile (25-ago-2026)
El nodo mainnet corre un solo proceso java-tron (sin solidity-node separado) pese
a `solidityEnable=true`/`solidityPort=8091` en config.conf — ese puerto/rol no
sirve tráfico real de forma independiente en este despliegue de un solo nodo.
Verificado en vivo: `walletsolidity/getaccount` → HTTP 405; `wallet/getblockbynum`
num=0 → string `"this API is closed because this node is a lite fullnode"`
(no un objeto de bloque). `getUnconfirmedAccount()` contra `wallet/getaccount`
sí responde 200 con el balance real — el fix ya desplegado en signer.mjs
funciona igual que en Nile. `TRON_NODE_LITE=true` y `TRON_SIGNER_WRITES_ENABLED=false`
confirmados en `/etc/tron-signer/tron-signer.env` del firmante mainnet.
**Why:** el mismo signer.mjs corre en ambas redes; sin esta confirmación quedaba
abierto si mainnet tenía un solidity-node real (haciendo el fix innecesario ahí)
o el mismo bug (haciendo el fix crítico). Confirmado: mismo bug, mismo fix, mismo
comportamiento observado en ambas redes.
**How to apply:** No asumir que `solidityEnable=true` en config.conf implica un
rol solidity-node funcional en un despliegue de un solo droplet; probar
`walletsolidity/*` en vivo antes de confiar en la config declarada.

## Infra mainnet recreada 7-sep-2026: IPs y VPC nuevos, ceremonia incompleta
La VPC `tron-mainnet-vpc` (10.30.0.0/20) y sus droplets (`tron-mainnet-lite`
165.227.106.97/10.30.0.2, `tron-signer-mainnet` 165.227.191.242/10.30.0.3)
fueron recreados el 7-sep-2026 — IDs/IPs de ago-2026 en este archivo quedaron
obsoletos. `banxico-plus-app` vive en una VPC distinta (`banxico-plus-vpc`,
10.10.0.0/20) sin *VPC peering* hacia `tron-mainnet-vpc`: sin eso, la app no
tiene ruta privada al firmante/nodo aunque todo lo demás funcione.
**Why:** un rearmado de infraestructura (nueva VPC/droplets) no reaprovisiona
por sí solo el firmante — la ceremonia manual (wallet+HMAC nacidos en host)
debe re-ejecutarse a mano; nada la dispara automáticamente. Señales de
ceremonia incompleta tras un rearmado: cero filas nuevas en `infra_logs` para
el host desde la fecha de recreación, firewalls de nube de DO creados pero con
`droplet_ids: []` (no adjuntos), TCP a 9443 devuelve "connection refused"
instantáneo (nada escuchando) mientras SSH sí acepta la conexión (host vivo).
**How to apply:** Antes de diagnosticar un firmante que no responde, comparar
`droplet.created_at` (API de DO) contra la última fila de `infra_logs` de ese
host; si el droplet es más nuevo que el último log, sospechar ceremonia nunca
completada en el host actual, no un fallo transitorio. Revisar también que los
firewalls de nube declarados (`GET /v2/firewalls`) tengan el droplet real en
`droplet_ids`.

## Verificar head-age del FullNode mainnet requiere SSH, no curl remoto (19-sep-2026)
El puerto 8090 del Cloud Firewall solo acepta `10.10.0.0/20`/`10.30.0.0/20`
(VPC), así que `curl` externo a la IP pública del nodo casi siempre da
timeout — un único intento que sí respondió resultó ser un fluke de red, no
conectividad real. La única forma confiable de leer `wallet/getnowblock` desde
fuera de la VPC es SSH al host (22 está abierto a 0.0.0.0/0 por la regla
residual amplia ya documentada arriba) y curlear `127.0.0.1:8090` desde dentro.
**Why:** confiar en un timeout externo como "nodo caído" sin entrar por SSH
puede confundir una política de firewall correcta con una falla real; hay que
diferenciar "no alcanzable desde aquí" de "no está escuchando ni siquiera en
localhost".
**How to apply:** Para verificar salud/head-age del FullNode mainnet, usar
`scripts/derive-do-ssh-key.sh` + `ssh root@<IP-pública>` y correr el curl
local, no intentarlo desde la red del agente.

## FullNode mainnet puede quedar completamente detenido, no solo atrasado (19-sep-2026)
El 17-sep-2026 06:03 UTC el contenedor `tron-mainnet-node` se detuvo
limpiamente (`docker stop`, exit 143) y nunca volvió a arrancar — `docker ps
-a` vacío, servicio `inactive (dead)`, sin reboots posteriores del host que lo
hubieran re-disparado. `Restart=on-failure` con `StartLimitBurst=3` no ayuda
si el proceso ya agotó su ventana de reintentos antes de la parada limpia.
Además, `tron-mainnet-health.timer` estaba desplegado pero `disabled`, y el
`.service` no tenía wrapper de alerta (a diferencia del patrón
`scripts/infra/tron-node/monitor.sh` de Nile) — la caída pasó inadvertida casi
3 días hasta esta verificación manual.
**Why:** "atrasado sincronizando" y "completamente detenido" requieren
diagnósticos y arreglos distintos; sin monitoreo activo ninguno de los dos se
detecta a tiempo.
**How to apply:** Antes de confiar en este nodo para saldos, no asumir que
"desplegado" implica "corriendo" — verificar `docker ps` y
`systemctl is-active tron-mainnet-node.service` por SSH. El monitor ahora
desplegado (`scripts/infra/tron-mainnet/monitor.sh` + `tron-mainnet-health.timer`
habilitado) registra fallas en el journal a severidad `daemon.alert`, pero
`TRON_ALERT_HOOK_PATH` sigue sin un adaptador de entrega aprobado — no hay
alerta real a una persona todavía (ver task de seguimiento).
