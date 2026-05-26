let rawQuestions = [];
let gameQuestions = [];
let currentIndex = 0;
let score = 0;
let errors = 0;
let timeLeft = 150;
let timerId = null;
let gameActive = false;
let isPaused = false;
let pendingQuestions = [];
let roscoStates = [];
let isRevealed = false;
let isClueRevealed = false;
let lastStatusMessage = "";

const socket = io();

const questionText = document.getElementById('question-text');
const defLabel = document.getElementById('def-label');
const solutionText = document.getElementById('solution-text');
const secretClueText = document.getElementById('secret-clue-text');
const sendBtn = document.getElementById('send-btn');
const failBtn = document.getElementById('fail-btn');
const pasapalabraBtn = document.getElementById('pasapalabra-btn');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const gameTimeInput = document.getElementById('game-time-input');
const setupArea = document.getElementById('setup-area');
const cancelBtn = document.getElementById('cancel-btn');
const stopBtn = document.getElementById('stop-btn');
const pauseBtn = document.getElementById('pause-btn');
const controls = document.getElementById('controls');
const secretInfo = document.getElementById('secret-info-container');
const btnReveal = document.getElementById('btn-reveal');
const btnRevealClue = document.getElementById('btn-reveal-clue');
const resultModal = document.getElementById('result-modal');
const finalStats = document.getElementById('final-stats');

// Elementos de puntuación en el Host
const hostScoreSuccess = document.getElementById('score-success');
const hostScoreFail = document.getElementById('score-fail');

async function loadQuestions() {
    try {
        const response = await fetch('questions.json');
        rawQuestions = await response.json();
        startBtn.style.display = 'block';
    } catch (error) {
        console.error('Error:', error);
        questionText.textContent = 'Error al cargar JSON.';
    }
}

function selectRandomQuestions() {
    gameQuestions = rawQuestions.map(item => {
        const randomIndex = Math.floor(Math.random() * item.questions.length);
        return {
            letter: item.letter,
            ...item.questions[randomIndex]
        };
    });
}

function broadcastState() {
    const currentQ = gameActive && pendingQuestions.length > 0 ? gameQuestions[pendingQuestions[currentIndex]] : null;
    
    // Clean formatting for the view
    let displayTipo = "";
    let displayDef = "";
    if (currentQ) {
        displayTipo = currentQ.tipo;
        displayDef = currentQ.definicion;
        // Avoid "Empieza por A A"
        if (displayTipo.endsWith(currentQ.letter)) {
            // It already includes the letter at the end, keep it as is or slightly adjust
        } else if (!displayTipo.includes(currentQ.letter)) {
            displayTipo = `${displayTipo} (${currentQ.letter})`;
        }
    }

    socket.emit('update_state', {
        questions: gameQuestions.map(q => q.letter),
        roscoStates,
        activeIndex: gameActive && pendingQuestions.length > 0 ? pendingQuestions[currentIndex] : -1,
        score,
        errors,
        timeLeft,
        gameActive,
        isPaused,
        currentQuestion: currentQ ? `${displayTipo}: ${displayDef}` : (gameActive ? (isPaused ? 'Juego Pausado' : 'Cargando...') : 'Esperando...'),
        // Split fields for better View control
        tipo: displayTipo,
        definicion: isPaused ? 'JUEGO PAUSADO' : displayDef,
        isClueRevealed,
        clue: currentQ ? currentQ.pista : '',
        respuesta: currentQ ? currentQ.respuesta : '',
        statusMessage: lastStatusMessage
    });
}

function startGame() {
    gameActive = true;
    isPaused = false;
    score = 0;
    errors = 0;
    timeLeft = parseInt(gameTimeInput.value) || 150;
    lastStatusMessage = "";
    selectRandomQuestions();
    pendingQuestions = gameQuestions.map((_, index) => index);
    roscoStates = gameQuestions.map(() => 'pending');
    currentIndex = 0;

    // Reset Host UI
    if (hostScoreSuccess) hostScoreSuccess.textContent = '0';
    if (hostScoreFail) hostScoreFail.textContent = '0';
    
    startBtn.style.display = 'none';
    setupArea.style.display = 'none';
    controls.style.display = 'block';
    secretInfo.style.display = 'grid';
    resultModal.style.display = 'none';
    
    if (pauseBtn) {
        pauseBtn.textContent = "Pausar";
        pauseBtn.classList.remove('btn-success');
        pauseBtn.classList.add('btn-warning');
    }
    
    showQuestion();
    startTimer();
}

function showQuestion() {
    if (pendingQuestions.length === 0) {
        endGame();
        return;
    }
    const q = gameQuestions[pendingQuestions[currentIndex]];
    
    // Better formatting for Host display
    let hostTipo = q.tipo;
    if (!hostTipo.includes(q.letter)) {
        hostTipo = `${hostTipo} (${q.letter})`;
    }
    
    defLabel.textContent = hostTipo;
    questionText.textContent = q.definicion;
    solutionText.textContent = q.respuesta;
    secretClueText.textContent = q.pista;
    
    // Reset reveals
    isRevealed = false;
    isClueRevealed = false;
    document.getElementById('solution-container').classList.remove('revealed');
    document.getElementById('clue-control-container').classList.remove('revealed');
    btnReveal.textContent = "Revelar Solución";
    btnRevealClue.textContent = "Revelar Pista";
    btnRevealClue.classList.remove('active-green');
    
    broadcastState();
}

function markResult(isCorrect) {
    if (!gameActive || isPaused || pendingQuestions.length === 0) return;
    const actualIndex = pendingQuestions[currentIndex];
    
    if (isCorrect) {
        score++;
        if (hostScoreSuccess) hostScoreSuccess.textContent = score;
        roscoStates[actualIndex] = 'success';
    } else {
        errors++;
        if (hostScoreFail) hostScoreFail.textContent = errors;
        roscoStates[actualIndex] = 'error';
    }

    pendingQuestions.splice(currentIndex, 1);
    
    if (pendingQuestions.length > 0) {
        if (currentIndex >= pendingQuestions.length) currentIndex = 0;
        showQuestion();
    } else {
        endGame();
    }
}

function pasapalabra() {
    if (!gameActive || isPaused || pendingQuestions.length === 0) return;
    currentIndex = (currentIndex + 1) % pendingQuestions.length;
    showQuestion();
}

function startTimer() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
        if (!gameActive) {
            clearInterval(timerId);
            return;
        }
        if (!isPaused) {
            timeLeft--;
            broadcastState();
            if (timeLeft <= 0) endGame();
        }
    }, 1000);
}

function togglePause() {
    if (!gameActive) return;
    isPaused = !isPaused;
    if (pauseBtn) {
        if (isPaused) {
            pauseBtn.textContent = "Reanudar";
            pauseBtn.classList.remove('btn-warning');
            pauseBtn.classList.add('btn-success');
            if (secretInfo) secretInfo.style.display = 'none';
        } else {
            pauseBtn.textContent = "Pausar";
            pauseBtn.classList.remove('btn-success');
            pauseBtn.classList.add('btn-warning');
            if (secretInfo) secretInfo.style.display = 'grid';
        }
    }
    broadcastState();
}

function endGame(message = "Juego Finalizado") {
    gameActive = false;
    isPaused = false;
    lastStatusMessage = message;
    clearInterval(timerId);
    controls.style.display = 'none';
    secretInfo.style.display = 'none';
    startBtn.style.display = 'block';
    setupArea.style.display = 'block';
    resultModal.style.display = 'flex';
    finalStats.textContent = `${message} | Aciertos: ${score} | Fallos: ${errors}`;
    
    // Emitir resultado para el ranking
    socket.emit('game_ended', {
        score,
        errors,
        timeLeft
    });
    
    broadcastState();
}

function stopGame() {
    if (confirm("¿Estás seguro de que quieres detener el juego? Se mostrarán los resultados finales.")) {
        endGame("Juego Detenido por el Host");
    }
}

function cancelSetup() {
    gameTimeInput.value = 150;
    defLabel.textContent = "Estado";
    questionText.textContent = "Configuración restablecida. Pulsa 'Iniciar Juego'.";
}

function toggleReveal() {
    isRevealed = !isRevealed;
    const solContainer = document.getElementById('solution-container');
    if (isRevealed) {
        solContainer.classList.add('revealed');
        btnReveal.textContent = "Ocultar Solución";
    } else {
        solContainer.classList.remove('revealed');
        btnReveal.textContent = "Revelar Solución";
    }
}

function toggleRevealClue() {
    isClueRevealed = !isClueRevealed;
    const clueContainer = document.getElementById('clue-control-container');
    if (isClueRevealed) {
        clueContainer.classList.add('revealed');
        btnRevealClue.textContent = "Ocultar Pista";
        btnRevealClue.classList.add('active-green');
    } else {
        clueContainer.classList.remove('revealed');
        btnRevealClue.textContent = "Revelar Pista";
        btnRevealClue.classList.remove('active-green');
    }
    broadcastState();
}

// Event Listeners
if (startBtn) startBtn.addEventListener('click', startGame);
if (sendBtn) sendBtn.addEventListener('click', () => markResult(true));
if (failBtn) failBtn.addEventListener('click', () => markResult(false));
if (pasapalabraBtn) pasapalabraBtn.addEventListener('click', pasapalabra);
if (restartBtn) restartBtn.addEventListener('click', startGame);
if (btnReveal) btnReveal.addEventListener('click', toggleReveal);
if (btnRevealClue) btnRevealClue.addEventListener('click', toggleRevealClue);
if (stopBtn) stopBtn.addEventListener('click', stopGame);
if (pauseBtn) pauseBtn.addEventListener('click', togglePause);
if (cancelBtn) cancelBtn.addEventListener('click', cancelSetup);

// Keyboard Shortcuts for the Host
document.addEventListener('keydown', (event) => {
    // Check if user is typing in the time input
    if (document.activeElement === gameTimeInput) return;

    if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        togglePause();
        return;
    }

    if (!gameActive || isPaused) return;

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        markResult(true);
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        markResult(false);
    } else if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        pasapalabra();
    } else if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        toggleReveal();
    } else if (event.key === 'p' || event.key === 'P') {
        event.preventDefault();
        toggleRevealClue();
    }
});

loadQuestions();
