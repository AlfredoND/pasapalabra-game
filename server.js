const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let rankings = [];

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('Un usuario se ha conectado');

    // Enviar rankings actuales al conectar
    socket.emit('rankings_updated', rankings);

    // Reenviar el estado del juego desde el Host a todos los clientes (especialmente al View)
    socket.on('update_state', (state) => {
        socket.broadcast.emit('state_updated', state);
    });

    socket.on('game_ended', (result) => {
        rankings.push({
            date: new Date().toLocaleString(),
            score: result.score,
            errors: result.errors,
            timeLeft: result.timeLeft
        });
        // Ordenar por aciertos (desc) y luego por menos fallos (asc)
        rankings.sort((a, b) => b.score - a.score || a.errors - b.errors);
        // Mantener solo los últimos 10
        rankings = rankings.slice(0, 10);
        io.emit('rankings_updated', rankings);
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de Pasapalabra corriendo en:`);
    console.log(`- Local: http://localhost:${PORT}`);
    // Nota: El usuario deberá usar su IP local para conectar otros dispositivos
});
