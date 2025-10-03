// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const { scrapeLikesWithCredentials } = require('./scraper');
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
app.get('/auth/instagram', (req, res) => {
    const state = Math.random().toString(36).substring(2, 15);
    const redirectUri = encodeURIComponent(process.env.INSTAGRAM_REDIRECT_URI);
    const scope = 'user_profile,user_media';

    const oauthUrl = `https://api.instagram.com/oauth/authorize?client_id=${process.env.INSTAGRAM_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=${state}`;

    res.redirect(oauthUrl);
});

// Callback route
app.get('/auth/instagram/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("❌ Code manquant dans la redirection Instagram.");

    try {
        // Échange code -> access_token
        const tokenResp = await axios.post("https://api.instagram.com/oauth/access_token", {
            client_id: process.env.INSTAGRAM_CLIENT_ID,
            client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
            grant_type: "authorization_code",
            redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
            code,
        });

        const access_token = tokenResp.data.access_token;
        const user_id = tokenResp.data.user_id;

        // Récup info utilisateur
        const userResp = await axios.get(`https://graph.instagram.com/${user_id}?fields=id,username,account_type&access_token=${access_token}`);
        const profilePic = `https://graph.instagram.com/${user_id}/picture?access_token=${access_token}`; // pas officiel, à bricoler

        const user = {
            display_name: userResp.data.username,
            avatar: profilePic,
        };

        res.cookie('instagramUser', JSON.stringify(user), { maxAge: 86400000 });
        res.redirect('/');
    } catch (err) {
        console.error('❌ OAuth Error:', err.response?.data || err.message);
        res.status(500).send("Erreur lors de l'authentification Instagram.");
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

// server.js (ajoute au début)
const { scrapeLikesWithCredentials } = require('./scraper');

// Endpoint POST /scrape-likes
// Body attendu: { username: 'insta_user', password: 'pass123' }
app.use(express.json({ limit: '1mb' }));

app.post('/scrape-likes', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'username & password required' });

    // WARNING: security risk - do not store these creds
    try {
        const result = await scrapeLikesWithCredentials({ username, password, headless: true });
        if (!result.success) return res.status(500).json(result);
        return res.json({ success: true, posts: result.posts });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message || String(err) });
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