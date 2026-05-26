const socket = io();

const roscoElement = document.getElementById('rosco');
const successCountElement = document.getElementById('success-count');
const errorCountElement = document.getElementById('error-count');
const viewDefLabel = document.getElementById('view-def-label');
const viewQuestionText = document.getElementById('view-question-text');
const clueBox = document.getElementById('clue-box');
const clueDisplay = document.getElementById('clue-display');

let roscoGenerated = false;
let currentQuestionsCount = 0;

socket.on('state_updated', (state) => {
    updateView(state);
});

socket.on('rankings_updated', (rankings) => {
    updateRanking(rankings);
});

function updateView(state) {
    // Si la cantidad de preguntas cambia o el juego se reinicia, regeneramos el rosco
    if (!roscoGenerated || currentQuestionsCount !== state.questions.length) {
        generateRosco(state.questions);
        roscoGenerated = true;
        currentQuestionsCount = state.questions.length;
    }

    const timeLeftElement = document.getElementById('time-left');

    // Actualizar letras
    state.roscoStates.forEach((status, index) => {
        const el = document.getElementById(`letter-${index}`);
        if (el) {
            el.className = `letter-node ${status}`;
            if (index === state.activeIndex) {
                el.classList.add('active');
            }
        }
    });

    // Actualizar estadísticas
    if (timeLeftElement) {
        timeLeftElement.textContent = state.timeLeft;
        if (state.timeLeft <= 20) {
            timeLeftElement.classList.add('timer-low');
        } else {
            timeLeftElement.classList.remove('timer-low');
        }
        
        if (state.isPaused) {
            timeLeftElement.classList.add('timer-paused');
        } else {
            timeLeftElement.classList.remove('timer-paused');
        }
    }

    successCountElement.textContent = state.score;
    errorCountElement.textContent = state.errors;

    // Actualizar Definición y Pista
    if (state.gameActive) {
        viewDefLabel.textContent = state.tipo;
        viewQuestionText.textContent = state.definicion;
        
        if (state.isPaused) {
            viewDefLabel.textContent = "PAUSADO";
            viewQuestionText.innerHTML = '<span style="color: #ffc107; font-weight: bold; font-size: 1.5rem;">JUEGO EN PAUSA</span>';
        }

        if (state.isClueRevealed && !state.isPaused) {
            clueBox.style.display = 'flex';
            clueDisplay.textContent = state.clue;
        } else {
            clueBox.style.display = 'none';
        }
    } else {
        viewDefLabel.textContent = "Estado";
        clueBox.style.display = 'none';
        
        if (state.statusMessage) {
            viewQuestionText.textContent = state.statusMessage;
        } else if (state.timeLeft === 0) {
            viewQuestionText.textContent = "¡TIEMPO AGOTADO!";
        } else if (state.score + state.errors > 0) {
            viewQuestionText.textContent = "JUEGO FINALIZADO";
        } else {
            viewQuestionText.textContent = "Esperando al Host...";
        }
    }
}

function updateRanking(rankings) {
    const rankingList = document.getElementById('ranking-list');
    if (!rankingList) return;

    if (rankings.length === 0) {
        rankingList.innerHTML = '<p style="text-align: center; opacity: 0.6;">No hay partidas registradas.</p>';
        return;
    }

    let html = '<table style="width: 100%; border-collapse: collapse;">';
    html += '<tr style="border-bottom: 1px solid rgba(255,255,255,0.2); opacity: 0.7;">';
    html += '<th style="text-align: left; padding: 5px;">Pos</th>';
    html += '<th style="text-align: left; padding: 5px;">Aciertos</th>';
    html += '<th style="text-align: left; padding: 5px;">Fallos</th>';
    html += '<th style="text-align: left; padding: 5px;">Fecha</th>';
    html += '</tr>';

    rankings.forEach((r, i) => {
        html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">`;
        html += `<td style="padding: 5px;">${i + 1}</td>`;
        html += `<td style="padding: 5px; color: #28a745; font-weight: bold;">${r.score}</td>`;
        html += `<td style="padding: 5px; color: #dc3545;">${r.errors}</td>`;
        html += `<td style="padding: 5px; font-size: 0.75rem; opacity: 0.8;">${r.date.split(',')[0]}</td>`;
        html += `</tr>`;
    });

    html += '</table>';
    rankingList.innerHTML = html;
}

function generateRosco(letters) {
    roscoElement.innerHTML = '';
    
    // El cronómetro se inserta dentro del rosco
    const timer = document.createElement('div');
    timer.className = 'timer-display';
    timer.id = 'time-left';
    timer.textContent = '150';
    roscoElement.appendChild(timer);

    const isSmallScreen = window.innerWidth <= 850;
    
    // Dimensiones del contenedor (debe coincidir con el CSS)
    const containerSize = isSmallScreen ? 320 : 500;
    const center = containerSize / 2;
    
    // Aumentamos el radio para que las letras no estén pegadas
    const radius = isSmallScreen ? 120 : 200; 

    const totalLetters = letters.length;

    letters.forEach((letter, index) => {
        // Calcular el ángulo (empezando desde arriba -PI/2)
        const angle = (index / totalLetters) * 2 * Math.PI - Math.PI / 2;
        
        // Calcular posición X e Y respecto al centro
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);

        const letterDiv = document.createElement('div');
        letterDiv.className = 'letter-node';
        letterDiv.id = `letter-${index}`;
        letterDiv.textContent = letter;
        
        // Usamos transform translate(-50%, -50%) en CSS, así que solo seteamos left/top al punto exacto
        letterDiv.style.left = `${x}px`;
        letterDiv.style.top = `${y}px`;
        
        roscoElement.appendChild(letterDiv);
    });
}

window.addEventListener('resize', () => {
    roscoGenerated = false; // Forzar regeneración en el próximo mensaje para ajustar posiciones
});
