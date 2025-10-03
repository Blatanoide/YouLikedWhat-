document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('login-button');
  const authContainer = document.getElementById('auth-container');
  const mainUI = document.getElementById('main-ui');
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');

    const user = JSON.parse(localStorage.getItem('instagramUser'));
  if (user) {
    showMainUI(user);
  }

    loginBtn.addEventListener('click', () => {
        window.location.href = '/auth/instagram';
    });

  function showMainUI(user) {
    authContainer.style.display = 'none';
    mainUI.style.display = 'block';
    userAvatar.src = user.avatar;
    userName.textContent = user.display_name;
  }

  document.getElementById('join-room').addEventListener('click', () => {
    const code = document.getElementById('room-code-input').value;
    if (/^\d{6}$/.test(code)) {
      alert('Tentative de rejoindre la room ' + code);
    } else {
      alert('Code invalide (6 chiffres)');
    }
  });

  document.getElementById('create-room').addEventListener('click', () => {
    const code = Math.floor(100000 + Math.random() * 900000);
    document.getElementById('room-created-code').style.display = 'block';
    document.getElementById('room-created-code').textContent = `Room créée ! Code : ${code}`;
  });
    document.getElementById('import-likes').addEventListener('click', async () => {
        const username = document.getElementById('insta-user').value;
        const password = document.getElementById('insta-pass').value;

        const resp = await fetch('/scrape-likes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const importBtn = document.getElementById('import-likes');
        if (importBtn) {
            importBtn.addEventListener('click', async () => {
                const username = document.getElementById('insta-user').value;
                const password = document.getElementById('insta-pass').value;

                const resp = await fetch('/scrape-likes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await resp.json();
                if (data.success) {
                    console.log("Likes récupérés :", data.posts);
                    alert("Tu as importé " + data.posts.length + " likes !");
                } else {
                    alert("Erreur : " + (data.error || data.message));
                }
            });
        }

        const data = await resp.json();
        if (data.success) {
            console.log("Likes récupérés :", data.posts);
            alert("Tu as importé " + data.posts.length + " likes !");
        } else {
            alert("Erreur : " + (data.error || data.message));
        }
    });
});