// app.js

// 1. La "Memoria" de nuestro juego
let puntuacionEstados = {};
let estadoLider = "Ninguno";
let maxPuntos = 0;

// ¡NUEVO! Diccionario para saber a qué estado apoya cada usuario
let jugadores = {};

// Conectamos el mapa con tu servidor de Render
// REEMPLAZA EL ENLACE CON EL QUE COPIASTE DE RENDER
const socket = io('https://guerramx-backend.onrender.com');

// Función para pintar automáticamente dentro de un estado
function ataqueDePixeles(idEstado, cantidadPuntos) {
    const estado = document.getElementById(idEstado);
    if (!estado) return;

    // 1. Sumamos los puntos a la memoria
    if (!puntuacionEstados[idEstado]) puntuacionEstados[idEstado] = 0;
    puntuacionEstados[idEstado] += cantidadPuntos;

    // 2. Revisamos si hay nuevo líder (Actualizamos el UI)
    if (puntuacionEstados[idEstado] > maxPuntos) {
        maxPuntos = puntuacionEstados[idEstado];
        estadoLider = idEstado;
        document.getElementById('ui-lider').innerText = estadoLider.replace(/_/g, ' ');
    }

    // 3. Calculamos dónde pintar (Obtenemos la caja geométrica del estado)
    const rectEstado = estado.getBoundingClientRect();
    const rectCanvas = document.getElementById('lienzo-pixeles').getBoundingClientRect();
    const ctx = document.getElementById('lienzo-pixeles').getContext('2d');

    // 4. Dibujamos la cantidad de píxeles que mandó el usuario
    for (let i = 0; i < cantidadPuntos; i++) {
        // Coordenadas aleatorias dentro de la caja del estado
        const x = (rectEstado.left + (Math.random() * rectEstado.width)) - rectCanvas.left;
        const y = (rectEstado.top + (Math.random() * rectEstado.height)) - rectCanvas.top;

        ctx.fillStyle = "#58a6ff"; // Color neón
        ctx.fillRect(x, y, 2, 2);
    }

    // 5. Efecto visual de "impacto" en el mapa
    estado.style.fill = '#238636'; 
    setTimeout(() => { estado.style.fill = ''; }, 150);
}


// --- ESCUCHANDO AL SERVIDOR DE TIKTOK ---

// 1. Cuando alguien comenta en el chat
socket.on('chatRecibido', (datos) => {
    let mensaje = datos.comentario.trim().toLowerCase();
    const estados = document.querySelectorAll('svg path');

    // Buscamos si el mensaje coincide con el nombre de algún estado
    estados.forEach(estado => {
        let id = estado.id; // Ej: "Nuevo_Leon"
        let nombreLimpio = id.replace(/_/g, ' ').toLowerCase(); // Ej: "nuevo leon"
        
        if (mensaje === nombreLimpio || mensaje === id.toLowerCase()) {
            // Asignamos al usuario a este estado
            jugadores[datos.usuario] = id;
            console.log(`💂 ${datos.usuario} se unió a las fuerzas de ${id}`);
        }
    });
});

// 2. Cuando alguien da Tap Tap
socket.on('tapRecibido', (datos) => {
    // Revisamos si el usuario ya eligió un estado comentando en el chat
    let estadoAsignado = jugadores[datos.usuario];
    
    if (estadoAsignado) {
        // Si ya tiene estado, disparamos el ataque automático
        // Limitamos a un máximo de 50 píxeles por ráfaga para no trabar el celular
        let puntosReales = Math.min(datos.cantidad, 50); 
        ataqueDePixeles(estadoAsignado, puntosReales);
    }
});


document.addEventListener("DOMContentLoaded", () => {
    const estados = document.querySelectorAll('svg path');
    const canvas = document.getElementById('lienzo-pixeles');
    const ctx = canvas.getContext('2d');
    
    // Elementos de la interfaz (Panel Inferior)
    const uiLider = document.getElementById('ui-lider');

    // 1. Calibrar el tamaño del Canvas para que coincida con la pantalla
    function ajustarCanvas() {
        const contenedor = document.getElementById('contenedor-juego');
        canvas.width = contenedor.clientWidth;
        canvas.height = contenedor.clientHeight;
    }

    // Ajustar al inicio y si se voltea la pantalla
    ajustarCanvas();
    window.addEventListener('resize', ajustarCanvas);

    // 2. Preparar los estados
    estados.forEach(estado => {
        estado.classList.add('estado');

        estado.addEventListener('click', (evento) => {
            const idEstado = evento.target.id || "Estado Desconocido";
            
            // Si el estado no existe en nuestra memoria, lo creamos con 0 puntos
            if (!puntuacionEstados[idEstado]) {
                puntuacionEstados[idEstado] = 0;
            }
            
            // 1. Sumamos un punto (un píxel) al estado tocado
            puntuacionEstados[idEstado]++;

            // 2. Revisamos si este estado ahora es el líder
            if (puntuacionEstados[idEstado] > maxPuntos) {
                maxPuntos = puntuacionEstados[idEstado];
                estadoLider = idEstado;
                
                // Limpiamos el texto por si el ID tiene guiones (ej. "Baja_California")
                let nombreLimpio = estadoLider.replace(/_/g, ' ');
                
                // Actualizamos el panel en la pantalla
                uiLider.innerText = nombreLimpio; 
            }

            // 3. Obtener las coordenadas exactas del clic relativas al Canvas
            const rect = canvas.getBoundingClientRect();
            const x = evento.clientX - rect.left;
            const y = evento.clientY - rect.top;

            // 4. Dibujar el píxel (un cuadradito de 2x2)
            ctx.fillStyle = "#58a6ff"; // Color azul premium (luego lo haremos dinámico)

            // Dibuja un píxel de 2x2 (mucho más fino y preciso)
            // Restamos 1 a X y Y para que el píxel quede exactamente en el centro de tu dedo
            ctx.fillRect(x - 1, y - 1, 2, 2);

            // Efecto visual en el mapa de fondo
            evento.target.style.fill = '#238636';
            setTimeout(() => {
                evento.target.style.fill = '';
            }, 150);
        });
    });
});

// Registrar el Service Worker para habilitar la instalación PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado con éxito', reg))
            .catch(err => console.warn('Error al registrar el Service Worker', err));
    });
}


// CÓDIGO DE PRUEBA (Borrar después)
setTimeout(() => {
    // 1. Simulamos que el usuario "Luis" escribe "coahuila" en el chat
    socket._callbacks['$chatRecibido'][0]({ usuario: "Luis", comentario: "coahuila" });
    
    // 2. Un segundo después, simulamos que "Luis" dio 10 likes a la pantalla
    setTimeout(() => {
        socket._callbacks['$tapRecibido'][0]({ usuario: "Luis", cantidad: 10 });
    }, 1000);
}, 2000);
