// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { nanoid } = require('nanoid');
const cors = require('cors');
const cookieParser = require('cookie-parser');

app.use(cookieParser());


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});
require('dotenv').config();
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const CALLBACK_URL = process.env.TIKTOK_CALLBACK_URL;

app.get('/auth/tiktok', (req, res) => {
    const state = Math.random().toString(36).substring(2);
    const params = new URLSearchParams({
        client_key: CLIENT_KEY,
        scope: 'user.info.basic',
        response_type: 'code',
        redirect_uri: CALLBACK_URL,
        state
    });
    res.redirect(`https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`);
});

app.get('/auth/tiktok/callback', async (req, res) => {
    const { code, state } = req.query;
    // (Optionnel) vérifie le state
    try {
        const tokenResp = await axios.post('https://open-api.tiktok.com/oauth/access_token', null, {
            params: { client_key: CLIENT_KEY, client_secret: CLIENT_SECRET, code, grant_type: 'authorization_code' }
        });
        const { access_token, refresh_token, open_id } = tokenResp.data.data;

        const userResp = await axios.get('https://open-api.tiktok.com/v2/user/info/', {
            headers: { Authorization: `Bearer ${access_token}` },
            params: { open_id, fields: 'open_id,display_name,avatar_url' }
        });

        // 🔐 Enregistre l’utilisateur (session, DB…)

        res.json({ success: true, user });
    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).send('Erreur TikTok OAuth');
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server à l'adresse http://localhost:${port}`));

app.use(cors());
app.use(express.static('public'));
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

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ➤ Route de redirection vers TikTok OAuth
app.get('/auth/tiktok', (req, res) => {
    const redirectUri = encodeURIComponent(process.env.TIKTOK_REDIRECT_URI);
    const state = Math.random().toString(36).substring(2, 15); // simple anti-CSRF
    const scope = 'user.info.basic';

    const oauthUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${process.env.TIKTOK_CLIENT_KEY}&scope=${scope}&response_type=code&redirect_uri=${redirectUri}&state=${state}`;

    res.redirect(oauthUrl);
});

// ➤ Callback TikTok (une fois l'utilisateur connecté)
app.get('/auth/tiktok/callback', async (req, res) => {
    const { code } = req.query;

    try {
        const response = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', {
            client_key: process.env.TIKTOK_CLIENT_KEY,
            client_secret: process.env.TIKTOK_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: process.env.TIKTOK_REDIRECT_URI,
        });

        const { access_token } = response.data;

        // ➤ Utiliser le token pour obtenir les infos utilisateur
        const userInfo = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        const user = userInfo.data.data.user;

        // ➤ Stocker les infos en cookie (ou session, ici simple pour front-end)
        res.cookie('tiktokUser', JSON.stringify({
            display_name: user.display_name,
            avatar: user.avatar_url,
        }), { maxAge: 86400000 }); // 1 jour

        res.redirect('/'); // Retour vers page d’accueil
    } catch (error) {
        console.error('Erreur OAuth:', error.response?.data || error.message);
        res.status(500).send('Erreur lors de l\'authentification.');
    }
});

// ➤ Route pour lire les infos utilisateur depuis le client
app.get('/auth/me', (req, res) => {
    if (req.cookies.tiktokUser) {
        res.json(JSON.parse(req.cookies.tiktokUser));
    } else {
        res.status(401).json({ error: 'Non authentifié' });
    }
});

app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});