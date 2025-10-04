# Banxico Plus - Sistema Bancario Completo

## Descripción del Proyecto
Plataforma bancaria completa con ticker financiero en tiempo real, POS virtual, procesamiento de transacciones, sistema de tokens y seguridad EMV/PCI DSS simulada.

## Colores Principales (Extraídos de las Capturas)

### Header y Branding
- **Background Header**: `#c8322b` (rojo Banxico)
- **Logo**: Icono de billete blanco
- **Texto Header**: `#ffffff` (blanco)

### Ticker Financiero
- **Background**: `#000000` (negro puro)
- **Texto**: `#ffffff` (blanco)
- **Fuente**: Arial, 14px

### Sidebar
- **Background**: `#1a1a1a` (gris muy oscuro)
- **Texto Normal**: `#e5e7eb` (gris claro)
- **Texto Activo**: `#ffffff` (blanco)
- **Item Hover**: `#2d2d2d`
- **Item Activo**: `#c8322b` (rojo)

### Dashboard
- **Background**: `#f5f5f5` (gris muy claro)
- **Cards**: `#ffffff` (blanco)
- **Bordes**: `#e5e7eb`
- **Texto Primario**: `#1f2937`
- **Texto Secundario**: `#6b7280`

### Botones y Acciones
- **Primario**: `#c8322b` (rojo Banxico)
- **Primario Hover**: `#a62822`
- **Secundario**: `#f3f4f6`
- **Texto Botón**: `#ffffff`

### Estados
- **Success**: `#10b981` (verde)
- **Warning**: `#f59e0b` (amarillo)
- **Error**: `#ef4444` (rojo)
- **Info**: `#3b82f6` (azul)

## Componentes Principales

### 1. Login Page
- Usuario: **Admin**
- Password: **Keylog100$**
- Logo Banxico Plus centrado
- Fondo con gradiente oscuro
- Formulario con validación

### 2. Header
- Logo de billete + "Banxico Plus" (lado izquierdo)
- Ticker financiero horizontal (datos en tiempo real)
- Iconos de notificaciones y usuario (lado derecho)
- Altura: 110px total (60px header + 50px ticker)

### 3. Ticker Financiero
**Datos mostrados exactamente como en la captura:**
- ON: $22.53
- CAD/MXN: $13.20
- BTC/USD: $54,325.75
- ETH/USD: $2,670.30
- XRP/USD: $0.52
- LTC/USD: $142.87
- DOT/USD: $15.32
- ADA/USD: $0.82

**Características:**
- Fondo negro (#000000)
- Texto blanco (#ffffff)
- Animación continua de derecha a izquierda
- Fuente Arial, 14px
- Separación: 40px entre items

### 4. Sidebar
**Usuario:**
- Avatar circular (imagen de perfil)
- Nombre: José Luis Barrientos
- Rol: ADMIN
- Subtítulo: Software Engineer
- Fecha: 3 May 2025

**Navegación:**
1. 📊 Dashboard
2. 🔄 Transacciones
3. 💰 Caja
4. 🏪 Enrutamiento POS
5. 📋 Registros
6. ₿ Exchange Crypto
7. 🔐 Claves Encriptadas

**Footer Sidebar:**
- Búsqueda
- Configuración

### 5. Dashboard Principal
- **Saldo disponible**: $1,250,000.00 USD (esquina superior derecha)
- Ticker con datos en tiempo real
- Acceso rápido a funciones

### 6. Nueva Transacción Bancaria
**Protocolos Disponibles:**
- 101.1 - Transferencia básica
- 101.2 - Transferencia con validación
- 101.3 - Transferencia segura ✓ (seleccionado por defecto)
- 201.1 - Pago nacional
- 201.2 - Pago internacional
- 201.3 - Pago express
- 301.1 - Depósito cuenta
- 301.2 - Depósito efectivo
- 401.1 - Retiro ATM

**Elementos:**
- Título: "Nueva Transacción Bancaria"
- Subtítulo: "Ingrese los datos para realizar una transferencia entre cuentas"
- Dropdown de protocolos (fondo blanco, selección roja)
- Botón: "Continuar al Testado de Seguridad" (rojo #c8322b)

**Panel Funciones Relacionadas:**
- updateTransactionStatus (18 llamadas)
- getAllTransactions (65 llamadas)
- generateTransactionId (49 llamadas)

### 7. POS Virtual
- Procesamiento de pagos VISA/Mastercard
- Verificación CVV2, PIN
- Códigos de autorización
- Registro de transacciones
- Controles: pausar, reanudar, velocidad

### 8. Sistema de Tokens
- Generación automática por transacción
- Formato: alphanumeric único
- Cifrado simulado AES-256
- Validación de integridad
- Cumplimiento EMV/PCI DSS

## Tipografía

**Fuentes:**
- Principal: Arial, sans-serif
- Monospace: Courier New (para códigos)

**Tamaños:**
- Títulos principales: 24px
- Subtítulos: 18px
- Texto normal: 14px
- Ticker: 14px
- Texto pequeño: 12px

## Espaciado

- Padding contenedores: 24px
- Gap entre elementos: 16px
- Margen entre secciones: 32px
- Border radius: 8px (tarjetas)

## Animaciones

**Ticker:**
- Velocidad base: 60px/segundo
- Loop infinito sin espacios
- Pausa/reanudación suave

**Transiciones:**
- Botones: 150ms ease
- Hover: 200ms ease
- Modals: 300ms ease-in-out

## Funcionalidad Completa

### Ticker Financiero
✅ Datos en tiempo real
✅ Fondo animado fluido
✅ Controles: pausar, reanudar, velocidad
✅ Actualización automática

### POS Virtual
✅ Procesamiento VISA/Mastercard/otros
✅ Verificación CVV2, PIN, autorización
✅ Registro transacciones rastreable
✅ Reportes: códigos autorización, estados, historial
✅ Controles POS: pausar, reanudar, velocidad
✅ Visualización transacciones en ticker tiempo real

### Tokens y Seguridad
✅ Generación token por transacción
✅ Validaciones integridad y cifrado (simulado)
✅ Protocolos EMV y PCI DSS (simulado)

### Integración Unificada
✅ Ticker + POS en dashboard único
✅ Datos simulados para demo
✅ Sin conexión redes reales
✅ Interfaz profesional y fluida
