document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const mensaje = document.getElementById('mensaje');
    mensaje.innerHTML = '';

    try {
        const resp = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await resp.json();

        if (data.ok) {
            sessionStorage.setItem('usuario', JSON.stringify(data.usuario));
            window.location.href = 'menu.html';
        } else {
            mensaje.innerHTML = `<div class="alert alert-error">${data.mensaje}</div>`;
        }
    } catch (err) {
        mensaje.innerHTML = `<div class="alert alert-error">No se pudo conectar con el servidor.</div>`;
    }
});
