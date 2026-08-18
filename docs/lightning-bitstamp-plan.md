# Plan formal — Rail Lightning con nodo propio + canal directo a Bitstamp

**Fecha:** 17-ago-2026 · **Precio BTC de referencia:** $64,298 USD (CoinGecko)
**Estado:** propuesta aprobada en dirección "plan formal"; pendiente de decisiones de fondeo para ejecutar.

---

## Objetivo

Agregar a Banxico Plus un rail de settlement instantáneo en BTC vía Lightning Network,
con nodo propio (LND) y canal directo al nodo de Bitstamp
(`02a04446caa81636d60d63b066f2814cbd3a6b5c258e3172cbdded...@3.122.40.122:9735`,
64 canales, 4.28 BTC de capacidad, online), integrado al motor de brokers existente
(hoy: OKX → Kraken → interno) como rail adicional, separado del flujo TRC-20/USDT.

## Prerrequisitos bloqueantes (antes de tocar nada de Lightning)

| # | Prerrequisito | Estado |
|---|---------------|--------|
| P1 | Rotación de llaves Stripe / OKX / MercadoPago (formulario seguro ya enviado) | ⏳ esperando valores del usuario |
| P2 | Rotación de wallet Tron — Task #75 | ⏳ propuesta, requiere confirmaciones de fondos |
| P3 | Hardening interno de droplets (fail2ban, sshd, ufw) — Task #76 | 🔄 en curso |

**Razón:** un nodo Lightning es una hot wallet con BTC real en el servidor. No se
monta una wallet nueva a mitad de una remediación de credenciales comprometidas.

## Fases y calendario (días hábiles desde el arranque, tras prerrequisitos)

### Fase 1 — Infraestructura del nodo (días 1–3)
- Droplet dedicado (no compartir con la app): Ubuntu 24.04, mismo patrón de seguridad
  actual (Cloud Firewall: solo 9735/tcp público para p2p Lightning; SSH restringido por IP).
- LND con backend **neutrino** (SPV) para arranque rápido y disco chico, con opción de
  migrar a `bitcoind` pruned después si el volumen lo justifica.
- Creación de wallet del nodo: la **seed (aezeed) la respalda el usuario offline** —
  nunca se guarda en el repo, ni en secrets de Replit, ni en el droplet en claro.
- Static Channel Backup (SCB) automatizado cada hora a DO Spaces (bucket privado).
- Monitoreo: alerta si el nodo está offline >5 min (mismo canal de alertas que ya usan).

### Fase 2 — Fondeo y apertura de canal (días 3–5; el ritmo lo pone el usuario)
- Usuario transfiere el capital decidido en BTC on-chain a la wallet del nodo
  (puede salir de OKX, retiro on-chain normal).
- `lncli connect` + `lncli openchannel` hacia la pubkey de Bitstamp; esperar 3–6 confirmaciones.
- Liquidez: un canal recién abierto es 100% saliente. Para poder **recibir** por Lightning:
  solicitar canal de vuelta a Bitstamp (tienen programa para contrapartes), o loop-out,
  o empujar saldo con un primer pago. Se define en esta fase según respuesta de Bitstamp.
- Nota legal: el nodo de Bitstamp prohíbe uso desde EE.UU.; al conectar se declara
  operar fuera de EE.UU. (operación actual: México — sin conflicto, pero queda asentado).

### Fase 3 — Integración backend (días 5–10)
- `server/lightning-client.ts`: cliente REST de LND (macaroon de invoices/pagos + cert TLS
  como secrets de Replit; el macaroon admin NUNCA sale del droplet del nodo).
- Endpoints internos: crear invoice, pagar invoice, consultar estado, y suscripción a
  settlements (stream de LND con reconexión + timeout, siguiendo el patrón
  response-guarantee ya establecido en el backend).
- Nuevo rail `lightning` en el broker-executor, aislado del flujo TRC-20; registro de
  pagos LN en DB (hash, preimage, monto, estado) para reconciliación.
- Panel admin: estado del nodo, saldo y liquidez del canal (in/out), últimos pagos.

### Fase 4 — Pruebas y go-live (días 10–14)
- Pruebas end-to-end con montos chicos reales (el nodo de Bitstamp es mainnet).
- Drill de recuperación: restaurar desde SCB en un droplet limpio (simulacro documentado).
- Runbook operativo: canal force-closed, nodo offline, liquidez agotada, sweep de excedentes.
- Criterio de go-live: 10 pagos reales consecutivos sin intervención manual + drill de
  restore exitoso + alertas verificadas.

## Presupuesto

### Gasto recurrente nuevo
| Concepto | Costo/mes |
|----------|-----------|
| Droplet nodo LN (2 vCPU / 4 GB / 80 GB) | $24 |
| DO Spaces (backups SCB) | $5 |
| **Total nuevo** | **~$29/mes** (infra total pasa de ~$39 a ~$68/mes) |

### Gasto one-shot
| Concepto | Costo |
|----------|-------|
| Fees on-chain (fondeo + apertura de canal) | $2–15 según mempool |

### Capital (no es gasto — queda propiedad de Banxico Plus, bloqueado en el canal)
| Escenario | BTC | USD aprox. hoy |
|-----------|-----|----------------|
| Mínimo útil | 0.05 | ~$3,215 |
| Recomendado | 0.10 | ~$6,430 |

> El capital del canal está expuesto a la volatilidad de BTC y a riesgo operativo de
> hot wallet. Mitigación: mantener en canal solo el flotante operativo y hacer sweep
> periódico del excedente a OKX/cold.

### Ingeniería
Ejecutada por Replit Agent dentro del plan actual — sin costo de contratista externo.
Estimación: ~10–14 días hábiles de calendario (el trabajo efectivo es menor; el
calendario lo estiran confirmaciones on-chain, respuesta de Bitstamp para canal de
vuelta, y ventanas de prueba con el usuario).

Del presupuesto de $4,000 USD asignado a auditoría/infraestructura: este plan solo
consume ~$29/mes + fees; el capital del canal es aparte y decisión del usuario.

## Riesgos principales y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Pérdida de estado de canales | Pérdida de fondos del canal | SCB horario a Spaces + drill de restore antes de go-live |
| Compromiso del droplet del nodo | Robo del saldo del canal | Firewall estricto, saldo acotado al flotante, sweep periódico, hardening previo (Task #76) |
| Nodo offline prolongado | Force-close del canal por Bitstamp | Monitoreo + alerta 5 min; runbook de recuperación |
| Sin liquidez inbound al inicio | No se puede recibir, solo pagar | Canal de vuelta de Bitstamp / loop-out en Fase 2 |
| Volatilidad BTC sobre el capital | Variación del valor del flotante | Flotante mínimo operativo; el grueso permanece en USDT como hoy |
| Cambios de política del nodo Bitstamp | Cierre unilateral del canal | El rail cae a los brokers existentes (OKX primario) sin downtime del producto |

## Decisiones que necesito del usuario antes de ejecutar

1. **Capital del canal:** 0.05 / 0.10 BTC u otro monto.
2. **Región del droplet del nodo** (default propuesto: nyc3, junto al resto).
3. **Confirmar orden:** prerrequisitos P1–P3 cerrados antes de Fase 1.
4. (Fase 2) ¿Solicitamos a Bitstamp canal de vuelta a nombre de la empresa?

## Qué NO incluye este plan

- Integración de Bitstamp como broker de trading en el executor (API de compra/venta) —
  es un proyecto aparte; este plan solo cubre el rail de settlement Lightning.
- Custodia fría / multisig del tesoro principal (sigue en OKX/USDT como hoy).
- Aceptar pagos Lightning de clientes finales en el checkout (posible Fase 5 futura).
