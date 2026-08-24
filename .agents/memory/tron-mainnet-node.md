---
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
