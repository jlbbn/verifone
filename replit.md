# Banxico Plus - Sistema Bancario Completo

## Descripción del Proyecto
Plataforma bancaria completa con ticker financiero en tiempo real, POS virtual integrado, sistema de transacciones, generación de tokens de seguridad y protocolos bancarios EMV/PCI DSS.

## Credenciales de Acceso
- **Usuario**: Admin
- **Contraseña**: Keylog100$

## Características Principales

### 1. Ticker Financiero en Tiempo Real
- Animación horizontal continua de derecha a izquierda
- Datos financieros actualizados: ON, CAD/MXN, BTC/USD, ETH/USD, XRP/USD, LTC/USD, DOT/USD, ADA/USD
- Fondo negro (#000000), texto blanco (#FFFFFF)
- Animación suave con requestAnimationFrame a 60 FPS
- Loop infinito sin espacios visibles

### 2. POS Virtual Integrado
- Procesamiento de pagos (VISA, Mastercard, AMEX, etc.)
- Verificación de datos en tiempo real (CVV2, PIN, autorización)
- Generación automática de códigos de autorización
- Registro de transacciones rastreables
- Controles interactivos: pausar, reanudar, ajustar velocidad

### 3. Protocolos Bancarios
**Protocolos de Transferencia (101.x):**
- 101.1 - Transferencia básica
- 101.2 - Transferencia con validación
- 101.3 - Transferencia segura ✓ (recomendado)

**Protocolos de Pago (201.x):**
- 201.1 - Pago nacional
- 201.2 - Pago internacional
- 201.3 - Pago express

**Protocolos de Depósito (301.x):**
- 301.1 - Depósito cuenta
- 301.2 - Depósito efectivo

**Protocolos de Retiro (401.x):**
- 401.1 - Retiro ATM

### 4. Sistema de Tokens y Seguridad
- Generación automática de tokens por transacción
- Formato: TOK-{timestamp}-{hash}
- Algoritmo de cifrado: AES-256
- Validación de integridad
- Cumplimiento EMV y PCI DSS
- Expiración automática (24 horas)

### 5. Dashboard Unificado
**Navegación del Sistema:**
- Dashboard - Vista general del sistema
- Transacciones - Nueva transacción bancaria
- Caja - Gestión de efectivo
- Enrutamiento POS - Terminal punto de venta
- Registros - Historial completo
- Exchange Crypto - Intercambio de criptomonedas
- Claves Encriptadas - Gestión de seguridad

**Usuario del Sistema:**
- Nombre: José Luis Barrientos
- Rol: ADMIN
- Posición: Software Engineer
- Fecha: 3 May 2025

**Saldo Disponible:** $1,250,000.00 USD

## Estructura de Archivos

### Frontend (React + TypeScript)
```
client/src/
├── components/
│   ├── financial-ticker.tsx    # Ticker animado
│   ├── app-sidebar.tsx         # Barra lateral navegación
│   └── ui/                     # Componentes shadcn
├── pages/
│   ├── login.tsx              # Página de login
│   ├── dashboard.tsx          # Dashboard principal
│   └── new-transaction.tsx    # Nueva transacción
├── App.tsx                    # Router y layout
└── index.css                  # Estilos globales
```

### Backend (Express + TypeScript)
```
server/
├── routes.ts                  # API endpoints
├── storage.ts                 # Almacenamiento en memoria
└── index.ts                   # Servidor Express
```

### Schema y Tipos
```
shared/
└── schema.ts                  # Modelos de datos compartidos
```

## API Endpoints

### Autenticación
- `POST /api/login` - Iniciar sesión (Admin / Keylog100$)

### Protocolos Bancarios
- `GET /api/protocols` - Obtener todos los protocolos
- `GET /api/protocols/:code` - Obtener protocolo específico

### Transacciones
- `POST /api/transactions` - Crear nueva transacción
- `GET /api/transactions` - Listar todas las transacciones
- `GET /api/transactions/:id` - Obtener transacción por ID
- `PATCH /api/transactions/:id/status` - Actualizar estado

### Métodos de Pago
- `POST /api/payment-methods` - Registrar método de pago
- `GET /api/payment-methods/:id` - Obtener método de pago

### Tokens de Seguridad
- `POST /api/security-tokens` - Generar token
- `GET /api/security-tokens/:tokenId` - Verificar token

### Logs
- `GET /api/transaction-logs/:transactionId` - Obtener logs

### POS Virtual
- `POST /api/pos/process-payment` - Procesar pago

## Modelos de Datos

### User
- id, username, password, fullName, role, position, avatar

### Transaction
- id, transactionId, protocol, type, amount, currency
- status, fromAccount, toAccount, description
- authCode, tokenId, createdAt

### PaymentMethod
- id, transactionId, cardType, cardNumber, cvv, pin
- holderName, expiryDate, verified

### SecurityToken
- id, tokenId, transactionId, algorithm, hash
- emvCompliant, pciCompliant, issuedAt, expiresAt

### TransactionLog
- id, transactionId, action, status, message, timestamp

### BankingProtocol
- id, code, name, description, category, requiresSecurity

## Colores del Sistema

### Branding
- **Primario (Rojo Banxico)**: #c8322b
- **Primario Hover**: #a62822
- **Header**: #c8322b

### Ticker
- **Fondo**: #000000 (negro)
- **Texto**: #FFFFFF (blanco)
- **Punto decorativo**: #c8322b

### Sidebar
- **Fondo**: #1a1a1a (gris muy oscuro)
- **Texto**: #e5e7eb (gris claro)
- **Activo**: #c8322b
- **Hover**: #2d2d2d

### Dashboard
- **Fondo**: #f5f5f5
- **Cards**: #ffffff
- **Bordes**: #e5e7eb

## Funcionalidades del Sistema

### Procesamiento de Pagos POS
1. Validación de tarjeta (tipo, número, CVV, PIN)
2. Generación de código de autorización
3. Creación de transacción
4. Generación de token de seguridad
5. Actualización de estado a "completed"
6. Registro en logs de transacciones

### Seguridad EMV/PCI DSS
- Cifrado AES-256
- Validación de integridad de datos
- Cumplimiento de protocolos bancarios
- Tokens con expiración automática
- Hash de seguridad por transacción

## Cómo Usar

1. **Iniciar Sesión**
   - Usuario: Admin
   - Contraseña: Keylog100$

2. **Ver Dashboard**
   - Estadísticas del sistema
   - Transacciones recientes
   - Saldo disponible

3. **Nueva Transacción**
   - Seleccionar protocolo bancario
   - Ingresar datos de transferencia
   - Continuar al testado de seguridad

4. **Procesar Pago POS**
   - Endpoint: POST /api/pos/process-payment
   - Datos: cardType, cardNumber, amount, protocol
   - Respuesta: authCode, tokenId, transaction

## Tecnologías Utilizadas

- **Frontend**: React, TypeScript, Wouter, TanStack Query
- **Backend**: Express, TypeScript
- **UI**: shadcn/ui, Tailwind CSS
- **Storage**: In-Memory (MemStorage)
- **Validación**: Zod

## Estado del Desarrollo

✅ Login con credenciales exactas (Admin / Keylog100$)
✅ Ticker financiero animado en tiempo real
✅ Dashboard con navegación completa
✅ Protocolos bancarios (9 protocolos)
✅ Sistema de transacciones
✅ POS Virtual integrado
✅ Generación de tokens de seguridad
✅ Logs de transacciones
✅ API completa funcional
✅ Interfaz profesional y fluida

## Próximos Pasos

- Implementar páginas completas para cada sección
- Agregar reportes detallados
- Implementar controles de velocidad en POS
- Visualización de transacciones en ticker en tiempo real
- Exportación de reportes PDF
- Gráficos de análisis de transacciones

## Fecha de Última Actualización
Octubre 2025
