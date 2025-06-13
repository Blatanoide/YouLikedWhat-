// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    },
});

// ENV VARIABLES
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const CALLBACK_URL = process.env.TIKTOK_REDIRECT_URI;

app.use(cors());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

console.log("✅ CLIENT_KEY =", CLIENT_KEY);
console.log("✅ CALLBACK_URL =", CALLBACK_URL);

// Auth route
app.get('/auth/tiktok', (req, res) => {
    const state = Math.random().toString(36).substring(2, 15);
    const scope = 'user.info.basic';
    const redirectUri = encodeURIComponent(CALLBACK_URL);

    const oauthUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${CLIENT_KEY}&scope=${scope}&response_type=code&redirect_uri=${redirectUri}&state=${state}`;

    console.log("🔗 Redirecting to TikTok:", oauthUrl);
    res.redirect(oauthUrl);
});

// Callback route
app.get('/auth/tiktok/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send("❌ Code manquant dans la redirection TikTok.");
    }

    try {
        const tokenResp = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', {
            client_key: CLIENT_KEY,
            client_secret: CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: CALLBACK_URL,
        });

        // 🔍 Affiche les headers pour récupérer le log ID TikTok
        console.log("📄 TikTok Response Headers:", tokenResp.headers);
        console.log("🪵 x-tt-logid:", tokenResp.headers['x-tt-logid']);
        console.log('✅ tokenResp.data:', tokenResp.data);
        const access_token = tokenResp.data.data.access_token;

        const userResp = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        const user = userResp.data.data.user;
        console.log("✅ User info:", user);

        res.cookie('tiktokUser', JSON.stringify({
            display_name: user.display_name,
            avatar: user.avatar_url,
        }), { maxAge: 86400000 });

        res.redirect('/');
    } catch (err) {
        console.error('❌ OAuth Error:', err.response?.data || err.message);
        res.status(500).send("Erreur lors de l'authentification.");
    }
});

// Auth check route
app.get('/auth/me', (req, res) => {
    if (req.cookies.tiktokUser) {
        res.json(JSON.parse(req.cookies.tiktokUser));
    } else {
        res.status(401).json({ error: "Non authentifié" });
    }
});

// Room logic (pas modifié ici)
const rooms = {};

io.on('connection', (socket) => {
    console.log('🔌 New user connected:', socket.id);

    socket.on('createRoom', ({ username }, callback) => {
        let roomCode;
        do {
            roomCode = Math.floor(100000 + Math.random() * 900000).toString();
        } while (rooms[roomCode]);

        rooms[roomCode] = {
            users: [{ id: socket.id, username }],
            maxPlayers: 15,
        };

        socket.join(roomCode);
        callback({ success: true, roomCode });
    });

    socket.on('joinRoom', ({ roomCode, username }, callback) => {
        const room = rooms[roomCode];
        if (!room) return callback({ success: false, message: "Room not found" });
        if (room.users.length >= room.maxPlayers)
            return callback({ success: false, message: "Room is full" });

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

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});