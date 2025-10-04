# Banxico Plus - Ticker Financiero

## Descripci\u00f3n del Proyecto
Aplicaci\u00f3n web de ticker financiero con animaci\u00f3n horizontal continua que muestra datos de Banxico, divisas y criptomonedas en tiempo real. Incluye controles interactivos para pausar/reanudar y ajustar la velocidad de desplazamiento.

## Caracter\u00edsticas Principales

### Ticker Animado
- **Animaci\u00f3n suave**: Utiliza `requestAnimationFrame` para movimiento fluido a 60 FPS
- **Direcci\u00f3n**: Desplazamiento continuo de derecha a izquierda
- **Loop infinito**: Los mensajes se repiten autom\u00e1ticamente sin cortes visibles
- **Dise\u00f1o**: Fondo negro (#000000), texto blanco (#FFFFFF), fuente Arial 20px
- **Separaci\u00f3n**: 30px entre cada mensaje

### Controles Interactivos
1. **Bot\u00f3n Pausar/Reanudar**: Detiene o reanuda la animaci\u00f3n
2. **Slider de Velocidad**: Ajusta la velocidad de 0.5x a 5.0x en tiempo real
3. **Indicador de Estado**: Muestra si el ticker est\u00e1 en reproducci\u00f3n o pausado
4. **Atajo de Teclado**: Barra espaciadora para pausar/reanudar

### Mensajes del Ticker
El array de mensajes incluye:
- **Tasas Banxico**: TIIE, Cetes, UDI, Inflaci\u00f3n
- **Divisas**: D\u00f3lar Spot, EUR/MXN, GBP/MXN, JPY/MXN
- **Criptomonedas**: BTC/USD, ETH/USD, XRP/USD, LTC/USD, DOT/USD, ADA/USD

## Estructura de Archivos

```
/
\u251c\u2500\u2500 index.html      # Estructura HTML del ticker y controles
\u251c\u2500\u2500 style.css       # Estilos visuales y dise\u00f1o responsivo
\u2514\u2500\u2500 script.js       # L\u00f3gica de animaci\u00f3n y controles
```

## Configuraci\u00f3n Editable

### En `script.js`:

**Array de Mensajes**:
```javascript
const mensajes = [
    "TIIE 28 d\u00edas: 11.15%",
    "D\u00f3lar Spot: $20.34",
    // Agregar m\u00e1s mensajes aqu\u00ed
];
```

**Velocidad Base**:
```javascript
let velocidad = 2; // p\u00edxeles por frame (1-10 recomendado)
```

### En `style.css`:

**Colores del Ticker**:
```css
.ticker-container {
    background-color: #000000; /* Fondo */
}

.ticker-item {
    color: #FFFFFF; /* Texto */
    font-size: 20px; /* Tama\u00f1o */
}
```

## C\u00f3mo Usar

1. **Abrir el proyecto**: Ejecutar `index.html` en el navegador
2. **Pausar/Reanudar**: Click en el bot\u00f3n o presionar Espacio
3. **Ajustar velocidad**: Mover el slider de velocidad
4. **Editar mensajes**: Modificar el array `mensajes` en `script.js`

## Caracter\u00edsticas T\u00e9cnicas

- **Animaci\u00f3n**: `requestAnimationFrame` para rendimiento \u00f3ptimo
- **Optimizaci\u00f3n**: Pausa autom\u00e1tica cuando la pesta\u00f1a est\u00e1 oculta
- **Responsive**: Adaptaci\u00f3n autom\u00e1tica a m\u00f3viles y tablets
- **Accesibilidad**: Atributos ARIA y `data-testid` para testing
- **Compatibilidad**: Navegadores modernos (Chrome, Firefox, Safari, Edge)

## Controles de Consola (Debugging)

En la consola del navegador:
```javascript
window.tickerControls.pausar()           // Pausar
window.tickerControls.reanudar()         // Reanudar
window.tickerControls.reiniciar()        // Reiniciar posici\u00f3n
window.tickerControls.agregarMensaje("Nuevo mensaje")
window.tickerControls.setVelocidad(3)    // Cambiar velocidad base
```

## Notas de Implementaci\u00f3n

- El ticker duplica los mensajes 3 veces para crear el efecto de loop continuo
- La posici\u00f3n se reinicia autom\u00e1ticamente cuando sale de vista
- Todos los comentarios est\u00e1n en espa\u00f1ol para facilitar la comprensi\u00f3n
- El c\u00f3digo es modular y f\u00e1cil de extender

## Fecha de Creaci\u00f3n
Octubre 2025
