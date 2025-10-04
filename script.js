/* ====================================================================
   BANXICO PLUS - L\u00d3GICA DEL TICKER FINANCIERO
   
   Este archivo contiene toda la l\u00f3gica de animaci\u00f3n del ticker,
   controles interactivos y configuraci\u00f3n de mensajes.
   
   PAR\u00c1METROS EDITABLES:
   - mensajes: Array con los textos que se mostrar\u00e1n en el ticker
   - velocidad: N\u00famero de p\u00edxeles que se mueve por frame (default: 2)
   ==================================================================== */

// ====================================================================
// CONFIGURACI\u00d3N - EDITAR ESTOS VALORES
// ====================================================================

/**
 * Array de mensajes que se mostrar\u00e1n en el ticker
 * Puedes agregar, eliminar o modificar estos mensajes seg\u00fan necesites.
 * Los mensajes se mostrar\u00e1n en el orden definido aqu\u00ed.
 */
const mensajes = [
    "TIIE 28 d\u00edas: 11.15%",
    "D\u00f3lar Spot: $20.34",
    "Cetes 28 d\u00edas: 11.00%",
    "Inflaci\u00f3n anual: 4.5%",
    "BTC/USD: $54,325.75",
    "ETH/USD: $2,870.50",
    "XRP/USD: $0.52",
    "LTC/USD: $142.87",
    "DOT/USD: $15.32",
    "ADA/USD: $0.42",
    "EUR/MXN: $21.45",
    "GBP/MXN: $25.80",
    "JPY/MXN: $0.14",
    "UDI: 8.12",
    "Cetes 91 d\u00edas: 10.85%",
    "Cetes 182 d\u00edas: 10.70%"
];

/**
 * Velocidad de desplazamiento del ticker
 * Valor en p\u00edxeles por frame (60 frames por segundo)
 * - Valores m\u00e1s altos = movimiento m\u00e1s r\u00e1pido
 * - Valores m\u00e1s bajos = movimiento m\u00e1s lento
 */
let velocidad = 2; // p\u00edxeles por frame

// ====================================================================
// VARIABLES GLOBALES DEL SISTEMA
// ====================================================================

let posicionActual = 0;           // Posici\u00f3n horizontal actual del ticker
let animacionActiva = true;       // Estado de la animaci\u00f3n (true = reproduciendo)
let requestId = null;             // ID de requestAnimationFrame
let anchoTotalContenido = 0;      // Ancho total del contenido duplicado
let multiplicadorVelocidad = 1;   // Multiplicador de velocidad (desde el slider)

// Referencias a elementos del DOM
const tickerContainer = document.getElementById('tickerContainer');
const tickerContent = document.getElementById('tickerContent');
const playPauseBtn = document.getElementById('playPauseBtn');
const playPauseText = document.getElementById('playPauseText');
const pauseIcon = document.getElementById('pauseIcon');
const playIcon = document.getElementById('playIcon');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// ====================================================================
// INICIALIZACI\u00d3N DEL TICKER
// ====================================================================

/**
 * Genera los elementos HTML del ticker
 * Duplica los mensajes para crear el efecto de loop infinito
 */
function inicializarTicker() {
    // Limpiar contenido previo
    tickerContent.innerHTML = '';
    
    // Crear elementos para cada mensaje (duplicado 4 veces para loop sin espacios)
    for (let i = 0; i < 4; i++) {
        mensajes.forEach((mensaje, index) => {
            const item = document.createElement('div');
            item.className = 'ticker-item';
            item.textContent = mensaje;
            item.setAttribute('data-testid', `ticker-item-${index}-${i}`);
            tickerContent.appendChild(item);
        });
    }
    
    // Calcular el ancho total del contenido
    // Esperamos un frame para que el DOM se actualice
    requestAnimationFrame(() => {
        // Calcular ancho de un set completo de mensajes
        const anchoUnSet = tickerContent.scrollWidth / 4;
        anchoTotalContenido = anchoUnSet;
        
        // Validar que el ancho sea v\u00e1lido antes de iniciar
        if (anchoTotalContenido > 0) {
            // Iniciar desde la posici\u00f3n 0 para loop continuo
            posicionActual = 0;
            tickerContent.style.transform = `translateX(${posicionActual}px)`;
            
            console.log('Ticker inicializado - Ancho total:', anchoTotalContenido);
        } else {
            console.error('Error: No se pudo calcular el ancho del ticker');
        }
    });
}

// ====================================================================
// ANIMACI\u00d3N DEL TICKER
// ====================================================================

/**
 * Funci\u00f3n principal de animaci\u00f3n usando requestAnimationFrame
 * Se ejecuta ~60 veces por segundo para animaci\u00f3n suave
 */
function animarTicker() {
    if (!animacionActiva) return;
    
    // Validar que el ancho del contenido sea v\u00e1lido
    if (anchoTotalContenido <= 0) {
        console.warn('Esperando c\u00e1lculo del ancho del ticker...');
        requestId = requestAnimationFrame(animarTicker);
        return;
    }
    
    // Calcular la velocidad real (velocidad base * multiplicador del slider)
    const velocidadReal = velocidad * multiplicadorVelocidad;
    
    // Mover el ticker hacia la izquierda
    posicionActual -= velocidadReal;
    
    // Usar operaci\u00f3n de m\u00f3dulo para loop continuo sin saltos
    // Esto asegura que nunca haya un espacio visible al reiniciar
    if (posicionActual <= -anchoTotalContenido) {
        posicionActual = posicionActual % anchoTotalContenido;
    }
    
    // Aplicar la transformaci\u00f3n CSS
    tickerContent.style.transform = `translateX(${posicionActual}px)`;
    
    // Solicitar el siguiente frame de animaci\u00f3n
    requestId = requestAnimationFrame(animarTicker);
}

/**
 * Iniciar la animaci\u00f3n del ticker
 */
function iniciarAnimacion() {
    animacionActiva = true;
    
    // Asegurar que siempre se solicite un nuevo frame al iniciar
    if (!requestId) {
        requestId = requestAnimationFrame(animarTicker);
    }
    
    actualizarEstadoUI(true);
    console.log('Animaci\u00f3n iniciada');
}

/**
 * Pausar la animaci\u00f3n del ticker
 */
function pausarAnimacion() {
    if (animacionActiva) {
        animacionActiva = false;
        if (requestId) {
            cancelAnimationFrame(requestId);
            requestId = null;
        }
        actualizarEstadoUI(false);
        console.log('Animaci\u00f3n pausada en posici\u00f3n:', posicionActual);
    }
}

/**
 * Alternar entre pausa y reproducci\u00f3n
 */
function toggleAnimacion() {
    if (animacionActiva) {
        pausarAnimacion();
    } else {
        iniciarAnimacion();
    }
}

// ====================================================================
// CONTROL DE VELOCIDAD
// ====================================================================

/**
 * Actualizar la velocidad del ticker desde el slider
 * @param {number} valor - Valor del slider (0.5 a 5.0)
 */
function actualizarVelocidad(valor) {
    multiplicadorVelocidad = parseFloat(valor);
    speedValue.textContent = multiplicadorVelocidad.toFixed(1) + 'x';
    console.log('Velocidad actualizada a:', multiplicadorVelocidad + 'x');
}

// ====================================================================
// ACTUALIZACI\u00d3N DE UI
// ====================================================================

/**
 * Actualizar los elementos visuales de la interfaz seg\u00fan el estado
 * @param {boolean} estaReproduciendo - true si est\u00e1 reproduciendo, false si est\u00e1 pausado
 */
function actualizarEstadoUI(estaReproduciendo) {
    if (estaReproduciendo) {
        // Mostrar bot\u00f3n de pausa
        pauseIcon.style.display = 'block';
        playIcon.style.display = 'none';
        playPauseText.textContent = 'Pausar';
        
        // Actualizar indicador de estado
        statusDot.classList.add('active');
        statusText.textContent = 'En reproducci\u00f3n';
    } else {
        // Mostrar bot\u00f3n de play
        pauseIcon.style.display = 'none';
        playIcon.style.display = 'block';
        playPauseText.textContent = 'Reanudar';
        
        // Actualizar indicador de estado
        statusDot.classList.remove('active');
        statusText.textContent = 'En pausa';
    }
}

// ====================================================================
// EVENT LISTENERS - Interacciones del usuario
// ====================================================================

/**
 * Bot\u00f3n de pausa/reproducci\u00f3n
 */
playPauseBtn.addEventListener('click', () => {
    toggleAnimacion();
});

/**
 * Slider de control de velocidad
 */
speedSlider.addEventListener('input', (e) => {
    actualizarVelocidad(e.target.value);
});

/**
 * Atajos de teclado (opcional)
 * Espacio = pausar/reanudar
 */
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        toggleAnimacion();
    }
});

// ====================================================================
// INICIALIZACI\u00d3N AL CARGAR LA P\u00c1GINA
// ====================================================================

/**
 * Ejecutar cuando el DOM est\u00e9 completamente cargado
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== BANXICO PLUS TICKER INICIADO ===');
    console.log('Mensajes configurados:', mensajes.length);
    console.log('Velocidad base:', velocidad, 'px/frame');
    
    // Inicializar el ticker con los mensajes
    inicializarTicker();
    
    // Iniciar la animaci\u00f3n despu\u00e9s de un peque\u00f1o delay
    // para asegurar que el DOM est\u00e9 listo
    setTimeout(() => {
        iniciarAnimacion();
    }, 100);
    
    // Configurar el valor inicial del slider
    speedValue.textContent = speedSlider.value + 'x';
    multiplicadorVelocidad = parseFloat(speedSlider.value);
});

// ====================================================================
// MANEJO DE VISIBILIDAD DE LA PESTA\u00d1A
// ====================================================================

/**
 * Pausar la animaci\u00f3n cuando la pesta\u00f1a no est\u00e1 visible
 * para ahorrar recursos del sistema
 */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pesta\u00f1a oculta - cancelar el frame de animaci\u00f3n
        if (requestId) {
            cancelAnimationFrame(requestId);
            requestId = null;
        }
    } else {
        // Pesta\u00f1a visible - reanudar si la animaci\u00f3n est\u00e1 activa
        if (animacionActiva) {
            // Asegurar que se solicite un nuevo frame
            if (!requestId) {
                requestId = requestAnimationFrame(animarTicker);
            }
        }
    }
});

// ====================================================================
// MANEJO DE REDIMENSIONAMIENTO DE VENTANA
// ====================================================================

/**
 * Recalcular el ancho del ticker cuando se redimensiona la ventana
 * para mantener el loop perfecto despu\u00e9s de cambios de layout
 */
let resizeTimeout;
window.addEventListener('resize', () => {
    // Usar debounce para evitar c\u00e1lculos excesivos
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (tickerContent.scrollWidth > 0) {
            const nuevoAncho = tickerContent.scrollWidth / 4;
            if (nuevoAncho !== anchoTotalContenido) {
                anchoTotalContenido = nuevoAncho;
                console.log('Ancho del ticker actualizado:', anchoTotalContenido);
            }
        }
    }, 250);
});

// ====================================================================
// FUNCIONES DE UTILIDAD (OPCIONAL)
// ====================================================================

/**
 * Reiniciar el ticker a su posici\u00f3n inicial
 */
function reiniciarTicker() {
    posicionActual = 0;
    tickerContent.style.transform = `translateX(${posicionActual}px)`;
    console.log('Ticker reiniciado');
}

/**
 * Agregar un nuevo mensaje al ticker din\u00e1micamente
 * @param {string} nuevoMensaje - Texto del mensaje a agregar
 */
function agregarMensaje(nuevoMensaje) {
    mensajes.push(nuevoMensaje);
    inicializarTicker();
    console.log('Mensaje agregado:', nuevoMensaje);
}

// Exportar funciones para uso en consola (debugging)
window.tickerControls = {
    pausar: pausarAnimacion,
    reanudar: iniciarAnimacion,
    reiniciar: reiniciarTicker,
    agregarMensaje: agregarMensaje,
    setVelocidad: (v) => { velocidad = v; console.log('Velocidad base cambiada a:', v); }
};

console.log('Controles disponibles en: window.tickerControls');
