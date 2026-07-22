// js/menu.js

// -------------------- Inicialización & Utilidades --------------------
lucide.createIcons();

// Custom Toast
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
    lucide.createIcons();
    
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

// DataTables common config
const dtConfig = {
    language: {
        url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json'
    },
    pageLength: 10,
    lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Todos"]],
    responsive: true,
    destroy: true, // Allow re-initialization
    dom: '<"dt-top"Blf>rt<"dt-bottom"ip>',
    buttons: [
        { extend: 'copy', className: 'dt-button', text: '<i data-lucide="copy" style="width:14px;height:14px;margin-right:4px;"></i> Copiar' },
        { extend: 'csv', className: 'dt-button', text: '<i data-lucide="file-text" style="width:14px;height:14px;margin-right:4px;"></i> CSV' },
        { extend: 'excel', className: 'dt-button', text: '<i data-lucide="table" style="width:14px;height:14px;margin-right:4px;"></i> Excel' },
        { extend: 'pdf', className: 'dt-button', text: '<i data-lucide="file" style="width:14px;height:14px;margin-right:4px;"></i> PDF' },
        { extend: 'print', className: 'dt-button', text: '<i data-lucide="printer" style="width:14px;height:14px;margin-right:4px;"></i> Imprimir' }
    ],
    drawCallback: function() {
        lucide.createIcons();
    }
};

// DataTables instances
let dtClientes, dtRango, dtRepTotales, dtRepDetalle, dtRepClientes;

// Mobile Sidebar Toggle
const btnMobileToggle = document.getElementById('btnMobileToggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.querySelector('.sidebar-overlay');

btnMobileToggle.addEventListener('click', () => {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
});

sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
});


// -------------------- Sesión --------------------
const usuarioRaw = sessionStorage.getItem('usuario');
if (!usuarioRaw) {
    window.location.href = 'login.html';
}
const usuario = JSON.parse(usuarioRaw || '{}');
const nombreUsuario = usuario.nombre || usuario.username || 'Usuario';
document.getElementById('lblUsuario').textContent = nombreUsuario;
document.getElementById('avatarInitial').textContent = nombreUsuario.charAt(0).toUpperCase();

document.getElementById('btnLogout').addEventListener('click', () => {
    Swal.fire({
        title: '¿Cerrar sesión?',
        text: 'Tendrás que volver a ingresar tus credenciales para acceder.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Cerrar sesión',
        cancelButtonText: 'Cancelar',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)'
    }).then((result) => {
        if (result.isConfirmed) {
            sessionStorage.removeItem('usuario');
            window.location.href = 'login.html';
        }
    });
});

// -------------------- Navegación entre secciones --------------------
const navItems = document.querySelectorAll('.nav-item[data-section]');
const sections = {
    crud: document.getElementById('sec-crud'),
    consultas: document.getElementById('sec-consultas'),
    reportes: document.getElementById('sec-reportes')
};

navItems.forEach(btn => {
    btn.addEventListener('click', () => {
        // Mobile close
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');

        navItems.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        Object.values(sections).forEach(s => {
            s.classList.add('hidden');
            s.classList.remove('animate-fadeIn');
        });
        
        const target = sections[btn.dataset.section];
        target.classList.remove('hidden');
        // Pequeño timeout para forzar re-animación
        setTimeout(() => target.classList.add('animate-fadeIn'), 10);

        if (btn.dataset.section === 'consultas') cargarSelectClientes();
        if (btn.dataset.section === 'reportes') cargarReportes();
    });
});

// -------------------- CRUD CLIENTES --------------------
const formCliente = document.getElementById('formCliente');
const btnGuardarCliente = document.getElementById('btnGuardarCliente');
const btnSubmitText = document.getElementById('btnSubmitText');

// Elementos del Modal
const modalOverlay = document.getElementById('modalClienteOverlay');
const modalTitulo = document.getElementById('modalClienteTitulo');
const btnNuevoClienteModal = document.getElementById('btnNuevoClienteModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelarModal = document.getElementById('btnCancelarModal');

function openModal(title, isEdit = false) {
    modalTitulo.innerHTML = `<i data-lucide="${isEdit ? 'edit' : 'user-plus'}"></i> ${title}`;
    btnSubmitText.textContent = isEdit ? 'Actualizar Cliente' : 'Guardar Cliente';
    modalOverlay.classList.add('active');
    lucide.createIcons();
}

function closeModal() {
    modalOverlay.classList.remove('active');
    setTimeout(() => formCliente.reset(), 300);
}

btnNuevoClienteModal.addEventListener('click', () => {
    document.getElementById('idCliente').value = '';
    formCliente.reset();
    openModal('Nuevo Cliente', false);
});

btnCloseModal.addEventListener('click', closeModal);
btnCancelarModal.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

async function cargarClientes() {
    try {
        const resp = await fetch('/api/clientes');
        const data = await resp.json();
        
        if (dtClientes) dtClientes.destroy();
        const tbody = document.getElementById('tablaClientes');
        tbody.innerHTML = '';

        if (!data.ok) return;

        if (data.clientes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state">
                <i data-lucide="users" class="empty-icon"></i>
                <p>No hay clientes registrados</p>
                </td></tr>`;
            lucide.createIcons();
            return;
        }

        data.clientes.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge badge-info">#${c.ID_CLIENTE}</span></td>
                <td><strong>${c.NOMBRE} ${c.APELLIDO}</strong></td>
                <td>${c.EMAIL}</td>
                <td>${c.TELEFONO || '<span style="opacity:0.5">-</span>'}</td>
                <td>${c.DIRECCION || '<span style="opacity:0.5">-</span>'}</td>
                <td class="actions" style="text-align:right">
                    <button class="btn-secondary btn-icon" onclick="editarCliente(${c.ID_CLIENTE})" title="Editar">
                        <i data-lucide="pencil" style="width:16px;height:16px"></i>
                    </button>
                    <button class="btn-danger btn-icon" onclick="eliminarCliente(${c.ID_CLIENTE})" title="Eliminar">
                        <i data-lucide="trash-2" style="width:16px;height:16px"></i>
                    </button>
                </td>`;
            tbody.appendChild(tr);
        });

        lucide.createIcons();
        dtClientes = $('#tablaClientesDt').DataTable(dtConfig);
    } catch(err) {
        showToast('Error cargando la tabla de clientes', 'error');
    }
}

formCliente.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('idCliente').value;
    const payload = {
        nombre: document.getElementById('nombre').value.trim(),
        apellido: document.getElementById('apellido').value.trim(),
        email: document.getElementById('email').value.trim(),
        telefono: document.getElementById('telefono').value.trim(),
        direccion: document.getElementById('direccion').value.trim()
    };

    btnGuardarCliente.disabled = true;
    const origHtml = btnGuardarCliente.innerHTML;
    btnGuardarCliente.innerHTML = 'Guardando...';

    try {
        let resp, data;
        if (id) {
            resp = await fetch(`/api/clientes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            resp = await fetch('/api/clientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
        data = await resp.json();

        if (data.ok) {
            showToast('Cliente guardado exitosamente', 'success');
            closeModal();
            cargarClientes();
        } else {
            showToast(data.mensaje, 'error');
        }
    } catch (err) {
        showToast('No se pudo conectar con el servidor', 'error');
    } finally {
        btnGuardarCliente.disabled = false;
        btnGuardarCliente.innerHTML = origHtml;
    }
});

// Expuesto al ambito global para onclick
window.editarCliente = async function(id) {
    try {
        const resp = await fetch(`/api/clientes/${id}`);
        const data = await resp.json();
        if (!data.ok) {
            showToast(data.mensaje, 'error');
            return;
        }

        const c = data.cliente;
        document.getElementById('idCliente').value = c.ID_CLIENTE;
        document.getElementById('nombre').value = c.NOMBRE;
        document.getElementById('apellido').value = c.APELLIDO;
        document.getElementById('email').value = c.EMAIL;
        document.getElementById('telefono').value = c.TELEFONO || '';
        document.getElementById('direccion').value = c.DIRECCION || '';

        openModal(`Editar Cliente #${c.ID_CLIENTE}`, true);
    } catch(err) {
        showToast('No se pudo cargar la información', 'error');
    }
}

window.eliminarCliente = async function(id) {
    Swal.fire({
        title: '¿Eliminar cliente?',
        text: 'Esta acción no se puede deshacer y puede fallar si tiene ventas asociadas.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--danger)',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const resp = await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
                const data = await resp.json();

                if(data.ok) {
                    showToast('Cliente eliminado', 'success');
                    cargarClientes();
                } else {
                    Swal.fire({
                        title: 'No se pudo eliminar',
                        text: data.mensaje,
                        icon: 'error',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)'
                    });
                }
            } catch (err) {
                showToast('Error al conectar con el servidor', 'error');
            }
        }
    });
}

// -------------------- CONSULTAS DE VENTAS --------------------
async function cargarSelectClientes() {
    try {
        const resp = await fetch('/api/clientes');
        const data = await resp.json();
        const select = document.getElementById('selectClienteVentas');
        select.innerHTML = '<option value="">Seleccione un cliente...</option>';

        if (!data.ok) return;
        data.clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.ID_CLIENTE;
            opt.textContent = `${c.NOMBRE} ${c.APELLIDO}`;
            select.appendChild(opt);
        });
    } catch(err) {
        console.error(err);
    }
}

document.getElementById('btnConsultarTotales').addEventListener('click', async () => {
    const idCliente = document.getElementById('selectClienteVentas').value;
    const div = document.getElementById('resultadoTotales');
    
    if (!idCliente) {
        showToast('Por favor, selecciona un cliente primero.', 'warning');
        return;
    }

    try {
        const resp = await fetch(`/api/ventas/totales/${idCliente}`);
        const data = await resp.json();

        if (data.ok) {
            div.innerHTML = `
                <div class="stats-row animate-scaleIn" style="margin-bottom:0">
                    <div class="stat-card">
                        <div class="stat-label">Número de compras</div>
                        <div class="stat-value">${data.numeroVentas}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Volumen total invertido</div>
                        <div class="stat-value success">$${Number(data.totalComprado).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                    </div>
                </div>
            `;
        } else {
            showToast(data.mensaje, 'error');
        }
    } catch(err) {
        showToast('Error de conexión', 'error');
    }
});

document.getElementById('btnConsultarRango').addEventListener('click', async () => {
    const inicio = document.getElementById('fechaInicio').value;
    const fin = document.getElementById('fechaFin').value;
    
    if (!inicio || !fin) {
        showToast('Selecciona ambas fechas para realizar la búsqueda.', 'warning');
        return;
    }

    try {
        const resp = await fetch(`/api/ventas/rango?inicio=${inicio}&fin=${fin}`);
        const data = await resp.json();
        
        if (dtRango) dtRango.destroy();
        const tbody = document.getElementById('tablaRango');
        tbody.innerHTML = '';

        if (!data.ok) return;

        if (data.ventas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state">
                <i data-lucide="calendar-x" class="empty-icon"></i>
                <p>No se encontraron ventas en este periodo</p>
                </td></tr>`;
            lucide.createIcons();
            return;
        }

        data.ventas.forEach(v => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge badge-info">#${v.ID_VENTA}</span></td>
                <td>${new Date(v.FECHA_VENTA).toLocaleDateString()}</td>
                <td>${v.CLIENTE}</td>
                <td><strong>$${Number(v.TOTAL).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</strong></td>`;
            tbody.appendChild(tr);
        });

        dtRango = $('#tablaRangoDt').DataTable(dtConfig);
    } catch(err) {
        showToast('Error de conexión', 'error');
    }
});

// -------------------- REPORTES --------------------
async function cargarReportes() {
    try {
        const [totales, detalle, activos] = await Promise.all([
            fetch('/api/reportes/ventas-totales-cliente').then(r => r.json()),
            fetch('/api/reportes/ventas-detalladas').then(r => r.json()),
            fetch('/api/reportes/clientes-activos').then(r => r.json())
        ]);

        // Cargar Estadísticas Globales Header
        let totalClientes = activos.ok ? activos.reporte.length : 0;
        let totalVentasGlobal = 0;
        let ingresosGlobales = 0;

        // Tabla 1: Totales por Cliente
        if (dtRepTotales) dtRepTotales.destroy();
        const tTotales = document.getElementById('tablaReporteTotales');
        tTotales.innerHTML = '';
        if (totales.ok) {
            totales.reporte.forEach(r => {
                totalVentasGlobal += r.NUMERO_VENTAS;
                ingresosGlobales += r.TOTAL_COMPRADO;
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><span class="badge badge-info">#${r.ID_CLIENTE}</span></td>
                    <td><strong>${r.NOMBRE} ${r.APELLIDO}</strong></td>
                    <td>${r.NUMERO_VENTAS}</td>
                    <td class="success"><strong>$${Number(r.TOTAL_COMPRADO).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</strong></td>`;
                tTotales.appendChild(tr);
            });
            dtRepTotales = $('#dtReporteTotales').DataTable(dtConfig);
        }

        // Actualizar Stats Header
        document.getElementById('statClientes').textContent = totalClientes;
        document.getElementById('statVentas').textContent = totalVentasGlobal;
        document.getElementById('statIngresos').textContent = '$' + Number(ingresosGlobales).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});

        // Tabla 2: Detalle de Ventas
        if (dtRepDetalle) dtRepDetalle.destroy();
        const tDetalle = document.getElementById('tablaReporteDetalle');
        tDetalle.innerHTML = '';
        if (detalle.ok) {
            detalle.reporte.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><span class="badge badge-info">#${r.ID_VENTA}</span></td>
                    <td>${new Date(r.FECHA_VENTA).toLocaleDateString()}</td>
                    <td>${r.CLIENTE}</td>
                    <td>${r.PRODUCTO}</td>
                    <td>${r.CANTIDAD}</td>
                    <td>$${Number(r.TOTAL_VENTA).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>`;
                tDetalle.appendChild(tr);
            });
            dtRepDetalle = $('#dtReporteDetalle').DataTable(dtConfig);
        }

        // Tabla 3: Clientes Activos
        if (dtRepClientes) dtRepClientes.destroy();
        const tClientes = document.getElementById('tablaReporteClientes');
        tClientes.innerHTML = '';
        if (activos.ok) {
            activos.reporte.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><span class="badge badge-info">#${r.ID_CLIENTE}</span></td>
                    <td><strong>${r.NOMBRE} ${r.APELLIDO}</strong></td>
                    <td>${r.EMAIL}</td>
                    <td>${new Date(r.FECHA_CREACION).toLocaleDateString()}</td>`;
                tClientes.appendChild(tr);
            });
            dtRepClientes = $('#dtReporteClientes').DataTable(dtConfig);
        }
        
        lucide.createIcons();

    } catch(err) {
        showToast('Hubo un problema cargando los reportes.', 'error');
    }
}

// -------------------- Carga Inicial --------------------
// Simulamos un pequeño delay visual para el skeleton loading
setTimeout(() => {
    cargarClientes();
}, 500);
