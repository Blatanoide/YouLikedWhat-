
const socket = io('http://localhost:3001');

const connectBtn = document.getElementById('connect-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomCodeInput = document.getElementById('room-code');
const usernameInput = document.getElementById('username');
const statusText = document.getElementById('status');

let currentRoom = null;

connectBtn.addEventListener('click', () => {
  statusText.innerText = 'Connecté (faux login TikTok)';
});

createRoomBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (!username) return alert('Entre un pseudo');
  socket.emit('createRoom', { username }, (res) => {
    if (res.success) {
      currentRoom = res.roomCode;
      statusText.innerText = `Room créée : ${res.roomCode}`;
    }
  });
});

joinRoomBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  const roomCode = roomCodeInput.value.trim();
  if (!username || !roomCode) return alert('Remplis tous les champs');
  socket.emit('joinRoom', { username, roomCode }, (res) => {
    if (res.success) {
      currentRoom = roomCode;
      statusText.innerText = `Rejoint la room : ${roomCode}`;
    } else {
      alert(res.message);
    }
  });
});

socket.on('userListUpdate', (users) => {
  console.log('Membres:', users.map(u => u.username).join(', '));
});
