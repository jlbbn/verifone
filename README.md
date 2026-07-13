# Banxico Plus LLC

Plataforma bancaria completa con ticker financiero en tiempo real, POS virtual integrado, sistema de transacciones, generación de tokens de seguridad y protocolos bancarios EMV/PCI DSS.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, TypeScript, Wouter, TanStack Query |
| Backend | Express 4, TypeScript, Node.js |
| UI | shadcn/ui, Tailwind CSS 3 |
| Base de datos | PostgreSQL + Drizzle ORM |
| Auth | Replit Auth (sesiones seguras) |
| Pagos | Stripe + MercadoPago |
| CI/CD | GitHub Actions |

## Características

- **Ticker financiero** — Animación 60 FPS continua con datos ON, CAD/MXN, BTC, ETH, XRP, LTC, DOT, ADA
- **POS Virtual** — Procesamiento VISA/MC/AMEX con CVV2, PIN y generación automática de códigos de autorización
- **Protocolos bancarios** — 9 protocolos EMV/PCI DSS (101.x transferencias, 201.x pagos, 301.x depósitos, 401.x retiros)
- **Tokens de seguridad** — AES-256, formato `TOK-{timestamp}-{hash}`, expiración 24h
- **Sistema de enrutamiento POS** — Inteligencia de ruteo con reglas configurables
- **Exchange Crypto** — Intercambio de criptomonedas integrado
- **Gestión de Caja** — USDT y efectivo
- **Documentos y Compliance** — Generación de documentos y verificación PCI DSS

## Instalación Local

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env   # Completar con tus credenciales

# Iniciar en desarrollo
npm run dev
```

## Variables de Entorno Requeridas

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=...
STRIPE_SECRET_KEY=sk_...
MERCADOPAGO_ACCESS_TOKEN=...
```

## Estructura del Proyecto

```
.
├── client/src/
│   ├── components/        # Componentes reutilizables
│   │   ├── ui/            # shadcn/ui components
│   │   ├── app-sidebar.tsx
│   │   ├── financial-ticker.tsx
│   │   └── pos-assignment-manager.tsx
│   ├── hooks/             # React hooks personalizados
│   ├── lib/               # Utilidades y cliente HTTP
│   └── pages/             # Páginas de la aplicación
│       ├── dashboard.tsx
│       ├── pos.tsx
│       ├── pos-virtual.tsx
│       ├── pos-intelligence.tsx
│       ├── new-transaction.tsx
│       ├── caja.tsx
│       ├── exchange.tsx
│       ├── claves.tsx
│       ├── registros.tsx
│       ├── documents.tsx
│       ├── compliance.tsx
│       └── subscription.tsx
├── server/
│   ├── routes.ts          # Todos los API endpoints
│   ├── storage.ts         # Capa de persistencia
│   ├── db.ts              # Conexión Drizzle/Postgres
│   ├── stripeClient.ts
│   ├── mercadopagoClient.ts
│   └── replit_integrations/auth/
├── shared/
│   └── schema.ts          # Modelos Drizzle compartidos
└── .github/workflows/     # CI/CD pipelines
```

## API Principal

### Autenticación
```
POST /api/login           — Iniciar sesión
GET  /api/user            — Usuario actual
POST /api/logout          — Cerrar sesión
```

### Transacciones
```
GET  /api/transactions          — Listar todas
POST /api/transactions          — Nueva transacción
GET  /api/transactions/:id      — Detalle
PATCH /api/transactions/:id/status — Actualizar estado
```

### POS
```
POST /api/pos/process-payment   — Procesar pago
GET  /api/pos/terminals         — Listar terminales
POST /api/pos/routing-rules     — Nueva regla de enrutamiento
GET  /api/pos/routing-decisions — Historial de decisiones
```

### Seguridad
```
POST /api/security-tokens       — Generar token
GET  /api/security-tokens/:id   — Verificar token
```

### Protocolos
```
GET /api/protocols              — Todos los protocolos
GET /api/protocols/:code        — Protocolo específico
```

## CI/CD

- **CI** — `npm install` → TypeScript check → Build on every push
- **Deploy** — Automático al hacer merge a `main`
- **PR Check** — Validación de PRs entrantes

## Sincronización con Replit

Para sincronizar cambios desde el entorno de desarrollo Replit a este repositorio:

```bash
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_... node sync-github.mjs
```

## Credenciales de Demo

| Campo | Valor |
|-------|-------|
| Usuario | Admin |
| Contraseña | Keylog100$ |
| Saldo disponible | $1,250,000.00 USD |

---

**Banxico Plus LLC** — Sistema Bancario Enterprise | Versión 2.0
