document.getElementById('formRegister').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombreCompleto = document.getElementById('nombreCompleto').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const password2 = document.getElementById('password2').value;
    const mensaje = document.getElementById('mensaje');
    mensaje.innerHTML = '';

    if (password !== password2) {
        mensaje.innerHTML = `<div class="alert alert-error">Las contrasenas no coinciden.</div>`;
        return;
    }

    try {
        const resp = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, nombreCompleto })
        });
        const data = await resp.json();

        if (data.ok) {
            mensaje.innerHTML = `<div class="alert alert-success">Usuario registrado. Redirigiendo al login...</div>`;
            setTimeout(() => window.location.href = 'login.html', 1200);
        } else {
            mensaje.innerHTML = `<div class="alert alert-error">${data.mensaje}</div>`;
        }
    } catch (err) {
        mensaje.innerHTML = `<div class="alert alert-error">No se pudo conectar con el servidor.</div>`;
    }
});
