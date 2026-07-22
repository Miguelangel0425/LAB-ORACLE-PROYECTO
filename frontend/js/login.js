// js/login.js
const showToast = (message, type = 'info') => {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'alert-circle';
    if (type === 'warning') icon = 'alert-triangle';

    toast.innerHTML = `
        <i data-lucide="${icon}" class="toast-icon"></i>
        <div class="toast-message">${message}</div>
        <button class="toast-close"><i data-lucide="x" style="width:14px;height:14px"></i></button>
    `;
    
    container.appendChild(toast);
    if(window.lucide) lucide.createIcons();
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.onclick = () => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    };
    
    setTimeout(() => {
        if(toast.parentElement) {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
};

document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('btnLogin');
    
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Verificando...';
    btn.classList.add('btn-loading');

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
            showToast(data.mensaje, 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
            btn.classList.remove('btn-loading');
        }
    } catch (err) {
        Swal.fire({
            title: 'Error de conexión',
            text: 'No se pudo conectar con el servidor. Verifica tu conexión.',
            icon: 'error',
            confirmButtonText: 'Entendido',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)'
        });
        btn.disabled = false;
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
    }
});
