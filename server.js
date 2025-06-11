// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { nanoid } = require('nanoid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

app.use(cors());

const rooms = {}; // { roomCode: { users: [], maxPlayers: 15 } }

io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);

    socket.on('createRoom', ({ username }, callback) => {
        let roomCode;
        do {
            roomCode = Math.floor(100000 + Math.random() * 900000).toString();
        } while (rooms[roomCode]);

        rooms[roomCode] = { users: [{ id: socket.id, username }], maxPlayers: 15 };
        socket.join(roomCode);
        callback({ success: true, roomCode });
    });

    socket.on('joinRoom', ({ roomCode, username }, callback) => {
        const room = rooms[roomCode];
        if (!room) return callback({ success: false, message: 'Room not found' });
        if (room.users.length >= room.maxPlayers) return callback({ success: false, message: 'Room is full' });

        room.users.push({ id: socket.id, username });
        socket.join(roomCode);
        io.to(roomCode).emit('userListUpdate', room.users);
        callback({ success: true });
    });

    socket.on('disconnect', () => {
        for (const code in rooms) {
            const room = rooms[code];
            room.users = room.users.filter(user => user.id !== socket.id);
            if (room.users.length === 0) delete rooms[code];
            else io.to(code).emit('userListUpdate', room.users);
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
server.listen(3001, () => console.log('🟢 Serveur démarré sur http://localhost:3001'));
