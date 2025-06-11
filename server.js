const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('Un joueur est connecté');

  socket.on('disconnect', () => {
    console.log('Un joueur s’est déconnecté');
  });
});

http.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
