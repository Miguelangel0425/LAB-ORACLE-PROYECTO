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
    destroy: true,
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

let dtClientes, dtRango, dtRepTotales, dtRepDetalle, dtRepClientes;
let dtProductos, dtVentasAdmin, dtUsuarios;

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
const token = sessionStorage.getItem('token');
if (!usuarioRaw || !token) {
    window.location.href = 'login.html';
}
const usuario = JSON.parse(usuarioRaw || '{}');
const nombreUsuario = usuario.nombre || usuario.username || 'Usuario';
const isAdmin = usuario.rol === 'ADMIN';

document.getElementById('lblUsuario').textContent = nombreUsuario;
document.getElementById('avatarInitial').textContent = nombreUsuario.charAt(0).toUpperCase();
document.getElementById('lblRol').textContent = isAdmin ? 'Administrador' : 'Usuario';

if (isAdmin) {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
}

async function authFetch(url, options = {}) {
    const headers = Object.assign({}, options.headers || {}, {
        'Authorization': `Bearer ${token}`
    });
    const resp = await fetch(url, { ...options, headers });
    if (resp.status === 401) {
        sessionStorage.removeItem('usuario');
        sessionStorage.removeItem('token');
        window.location.href = 'login.html';
        throw new Error('No autenticado');
    }
    return resp;
}

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
    }).then(async (result) => {
        if (result.isConfirmed) {
            try { await authFetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
            sessionStorage.removeItem('usuario');
            sessionStorage.removeItem('token');
            window.location.href = 'login.html';
        }
    });
});

// -------------------- Navegación entre secciones --------------------
const navItems = document.querySelectorAll('.nav-item[data-section]');
const sections = {
    crud: document.getElementById('sec-crud'),
    consultas: document.getElementById('sec-consultas'),
    reportes: document.getElementById('sec-reportes'),
    productos: document.getElementById('sec-productos'),
    ventasAdmin: document.getElementById('sec-ventasAdmin'),
    usuarios: document.getElementById('sec-usuarios')
};

navItems.forEach(btn => {
    btn.addEventListener('click', () => {
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
        setTimeout(() => target.classList.add('animate-fadeIn'), 10);

        if (btn.dataset.section === 'consultas') cargarSelectClientes();
        if (btn.dataset.section === 'reportes') cargarReportes();
        if (btn.dataset.section === 'productos') cargarProductos();
        if (btn.dataset.section === 'ventasAdmin') {
            cargarSelectClientesVenta();
            cargarProductosParaVenta();
            if (isAdmin) cargarVentasAdmin();
        }
        if (btn.dataset.section === 'usuarios') cargarUsuarios();
    });
});

// -------------------- CRUD CLIENTES --------------------
const formCliente = document.getElementById('formCliente');
const btnGuardarCliente = document.getElementById('btnGuardarCliente');
const btnSubmitText = document.getElementById('btnSubmitText');

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
        const resp = await authFetch('/api/clientes');
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
            const botonEstadoAdmin = isAdmin ? `
                    <button class="btn-secondary btn-icon" onclick="cambiarEstadoCliente(${c.ID_CLIENTE}, ${c.ACTIVO})" title="${c.ACTIVO === 1 ? 'Desactivar' : 'Activar'}">
                        <i data-lucide="power" style="width:16px;height:16px"></i>
                    </button>` : '';
            tr.innerHTML = `
                <td><span class="badge badge-info">#${c.ID_CLIENTE}</span></td>
                <td><strong>${c.NOMBRE} ${c.APELLIDO}</strong> ${c.ACTIVO === 0 ? '<span class="badge badge-danger" style="margin-left:6px;">Inactivo</span>' : ''}</td>
                <td>${c.EMAIL}</td>
                <td>${c.TELEFONO || '<span style="opacity:0.5">-</span>'}</td>
                <td>${c.DIRECCION || '<span style="opacity:0.5">-</span>'}</td>
                <td class="actions" style="text-align:right">
                    <button class="btn-secondary btn-icon" onclick="editarCliente(${c.ID_CLIENTE})" title="Editar">
                        <i data-lucide="pencil" style="width:16px;height:16px"></i>
                    </button>
                    ${botonEstadoAdmin}
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
            resp = await authFetch(`/api/clientes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            resp = await authFetch('/api/clientes', {
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

window.editarCliente = async function(id) {
    try {
        const resp = await authFetch(`/api/clientes/${id}`);
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
                const resp = await authFetch(`/api/clientes/${id}`, { method: 'DELETE' });
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

window.cambiarEstadoCliente = async function(id, activoActual) {
    const nuevoEstado = activoActual === 1 ? 0 : 1;
    try {
        const resp = await authFetch(`/api/clientes/${id}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: nuevoEstado })
        });
        const data = await resp.json();
        if (data.ok) {
            showToast(nuevoEstado === 1 ? 'Cliente activado' : 'Cliente desactivado', 'success');
            cargarClientes();
        } else {
            showToast(data.mensaje, 'error');
        }
    } catch (err) {
        showToast('Error al conectar con el servidor', 'error');
    }
}

// -------------------- CONSULTAS DE VENTAS --------------------
async function cargarSelectClientes() {
    try {
        const resp = await authFetch('/api/clientes');
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
        const resp = await authFetch(`/api/ventas/totales/${idCliente}`);
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
        const resp = await authFetch(`/api/ventas/rango?inicio=${inicio}&fin=${fin}`);
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
            authFetch('/api/reportes/ventas-totales-cliente').then(r => r.json()),
            authFetch('/api/reportes/ventas-detalladas').then(r => r.json()),
            authFetch('/api/reportes/clientes-activos').then(r => r.json())
        ]);

        let totalClientes = activos.ok ? activos.reporte.length : 0;
        let totalVentasGlobal = 0;
        let ingresosGlobales = 0;

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

        document.getElementById('statClientes').textContent = totalClientes;
        document.getElementById('statVentas').textContent = totalVentasGlobal;
        document.getElementById('statIngresos').textContent = '$' + Number(ingresosGlobales).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});

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

// ==================== GESTION DE PRODUCTOS (solo ADMIN) ====================
const formProducto = document.getElementById('formProducto');
const btnGuardarProducto = document.getElementById('btnGuardarProducto');
const btnProductoSubmitText = document.getElementById('btnProductoSubmitText');
const modalProductoOverlay = document.getElementById('modalProductoOverlay');
const modalProductoTitulo = document.getElementById('modalProductoTitulo');
const btnNuevoProductoModal = document.getElementById('btnNuevoProductoModal');
const btnCloseModalProducto = document.getElementById('btnCloseModalProducto');
const btnCancelarModalProducto = document.getElementById('btnCancelarModalProducto');

function openModalProducto(title, isEdit = false) {
    modalProductoTitulo.innerHTML = `<i data-lucide="${isEdit ? 'edit' : 'plus'}"></i> ${title}`;
    btnProductoSubmitText.textContent = isEdit ? 'Actualizar Producto' : 'Guardar Producto';
    modalProductoOverlay.classList.add('active');
    lucide.createIcons();
}
function closeModalProducto() {
    modalProductoOverlay.classList.remove('active');
    setTimeout(() => formProducto.reset(), 300);
}

if (btnNuevoProductoModal) {
    btnNuevoProductoModal.addEventListener('click', () => {
        document.getElementById('idProducto').value = '';
        formProducto.reset();
        openModalProducto('Nuevo Producto', false);
    });
    btnCloseModalProducto.addEventListener('click', closeModalProducto);
    btnCancelarModalProducto.addEventListener('click', closeModalProducto);
    modalProductoOverlay.addEventListener('click', (e) => {
        if (e.target === modalProductoOverlay) closeModalProducto();
    });
}

async function cargarProductos() {
    try {
        const resp = await authFetch('/api/productos');
        const data = await resp.json();

        if (dtProductos) dtProductos.destroy();
        const tbody = document.getElementById('tablaProductos');
        tbody.innerHTML = '';

        if (!data.ok) return;

        if (data.productos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state">
                <i data-lucide="package" class="empty-icon"></i>
                <p>No hay productos registrados</p>
                </td></tr>`;
            lucide.createIcons();
            return;
        }

        data.productos.forEach(p => {
            const tr = document.createElement('tr');
            const accionesAdmin = isAdmin ? `
                    <button class="btn-secondary btn-icon" onclick="editarProducto(${p.ID_PRODUCTO})" title="Editar">
                        <i data-lucide="pencil" style="width:16px;height:16px"></i>
                    </button>
                    <button class="btn-danger btn-icon" onclick="eliminarProducto(${p.ID_PRODUCTO})" title="Eliminar">
                        <i data-lucide="trash-2" style="width:16px;height:16px"></i>
                    </button>` : '<span style="opacity:0.5; font-size:12px;">Solo lectura</span>';
            tr.innerHTML = `
                <td><span class="badge badge-info">#${p.ID_PRODUCTO}</span></td>
                <td><strong>${p.NOMBRE}</strong></td>
                <td>${p.DESCRIPCION || '<span style="opacity:0.5">-</span>'}</td>
                <td>$${Number(p.PRECIO).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                <td><span class="badge ${p.STOCK > 0 ? 'badge-success' : 'badge-danger'}">${p.STOCK}</span></td>
                <td class="actions" style="text-align:right">${accionesAdmin}</td>`;
            tbody.appendChild(tr);
        });

        lucide.createIcons();
        dtProductos = $('#tablaProductosDt').DataTable(dtConfig);
    } catch (err) {
        showToast('Error cargando el catálogo de productos', 'error');
    }
}

if (formProducto) {
    formProducto.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('idProducto').value;
        const payload = {
            nombre: document.getElementById('prodNombre').value.trim(),
            descripcion: document.getElementById('prodDescripcion').value.trim(),
            precio: Number(document.getElementById('prodPrecio').value),
            stock: Number(document.getElementById('prodStock').value)
        };

        btnGuardarProducto.disabled = true;
        const origHtml = btnGuardarProducto.innerHTML;
        btnGuardarProducto.innerHTML = 'Guardando...';

        try {
            let resp;
            if (id) {
                resp = await authFetch(`/api/productos/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                resp = await authFetch('/api/productos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
            const data = await resp.json();
            if (data.ok) {
                showToast('Producto guardado exitosamente', 'success');
                closeModalProducto();
                cargarProductos();
            } else {
                showToast(data.mensaje, 'error');
            }
        } catch (err) {
            showToast('No se pudo conectar con el servidor', 'error');
        } finally {
            btnGuardarProducto.disabled = false;
            btnGuardarProducto.innerHTML = origHtml;
        }
    });
}

window.editarProducto = async function(id) {
    try {
        const resp = await authFetch(`/api/productos/${id}`);
        const data = await resp.json();
        if (!data.ok) { showToast(data.mensaje, 'error'); return; }

        const p = data.producto;
        document.getElementById('idProducto').value = p.ID_PRODUCTO;
        document.getElementById('prodNombre').value = p.NOMBRE;
        document.getElementById('prodDescripcion').value = p.DESCRIPCION || '';
        document.getElementById('prodPrecio').value = p.PRECIO;
        document.getElementById('prodStock').value = p.STOCK;

        openModalProducto(`Editar Producto #${p.ID_PRODUCTO}`, true);
    } catch (err) {
        showToast('No se pudo cargar la información', 'error');
    }
}

window.eliminarProducto = async function(id) {
    Swal.fire({
        title: '¿Eliminar producto?',
        text: 'Esta acción no se puede deshacer y puede fallar si ya tiene ventas asociadas.',
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
                const resp = await authFetch(`/api/productos/${id}`, { method: 'DELETE' });
                const data = await resp.json();
                if (data.ok) {
                    showToast('Producto eliminado', 'success');
                    cargarProductos();
                } else {
                    Swal.fire({ title: 'No se pudo eliminar', text: data.mensaje, icon: 'error', background: 'var(--bg-card)', color: 'var(--text-primary)' });
                }
            } catch (err) {
                showToast('Error al conectar con el servidor', 'error');
            }
        }
    });
}

// ==================== GESTION DE VENTAS (solo ADMIN) ====================
let catalogoProductos = [];

async function cargarSelectClientesVenta() {
    try {
        const resp = await authFetch('/api/clientes');
        const data = await resp.json();
        const select = document.getElementById('selectClienteVenta');
        select.innerHTML = '<option value="">Seleccione un cliente...</option>';
        if (!data.ok) return;
        data.clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.ID_CLIENTE;
            opt.textContent = `${c.NOMBRE} ${c.APELLIDO}`;
            select.appendChild(opt);
        });
    } catch (err) { console.error(err); }
}

async function cargarProductosParaVenta() {
    try {
        const resp = await authFetch('/api/productos');
        const data = await resp.json();
        catalogoProductos = data.ok ? data.productos : [];
    } catch (err) { console.error(err); }
}

function crearOpcionesProducto(selectEl) {
    selectEl.innerHTML = '<option value="">Seleccione...</option>';
    catalogoProductos.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.ID_PRODUCTO;
        opt.dataset.precio = p.PRECIO;
        opt.dataset.stock = p.STOCK;
        opt.textContent = `${p.NOMBRE} ($${Number(p.PRECIO).toFixed(2)} - stock: ${p.STOCK})`;
        selectEl.appendChild(opt);
    });
}

function recalcularTotalVenta() {
    let total = 0;
    document.querySelectorAll('#lineasVenta tr').forEach(tr => {
        const subtotalSpan = tr.querySelector('.linea-subtotal');
        total += Number(subtotalSpan.dataset.valor || 0);
    });
    document.getElementById('totalVentaNueva').textContent = '$' + total.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
}

function actualizarSubtotalLinea(tr) {
    const select = tr.querySelector('.linea-producto');
    const cantidadInput = tr.querySelector('.linea-cantidad');
    const subtotalSpan = tr.querySelector('.linea-subtotal');
    const opt = select.selectedOptions[0];
    const precio = opt && opt.dataset.precio ? Number(opt.dataset.precio) : 0;
    const cantidad = Number(cantidadInput.value) || 0;
    const subtotal = precio * cantidad;
    subtotalSpan.textContent = '$' + subtotal.toFixed(2);
    subtotalSpan.dataset.valor = subtotal;
    recalcularTotalVenta();
}

function agregarLineaVenta() {
    const tbody = document.getElementById('lineasVenta');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>
            <div class="input-group" style="margin:0;">
                <select class="linea-producto"></select>
            </div>
        </td>
        <td><input type="number" class="linea-cantidad" min="1" step="1" value="1" style="width:100%; padding:8px;"></td>
        <td><span class="linea-subtotal" data-valor="0">$0.00</span></td>
        <td style="text-align:center;">
            <button type="button" class="btn-danger btn-icon btn-quitar-linea" title="Quitar">
                <i data-lucide="x" style="width:14px;height:14px"></i>
            </button>
        </td>`;
    tbody.appendChild(tr);

    const select = tr.querySelector('.linea-producto');
    crearOpcionesProducto(select);
    select.addEventListener('change', () => actualizarSubtotalLinea(tr));
    tr.querySelector('.linea-cantidad').addEventListener('input', () => actualizarSubtotalLinea(tr));
    tr.querySelector('.btn-quitar-linea').addEventListener('click', () => {
        tr.remove();
        recalcularTotalVenta();
    });

    lucide.createIcons();
}

const btnAgregarLinea = document.getElementById('btnAgregarLinea');
if (btnAgregarLinea) {
    btnAgregarLinea.addEventListener('click', () => {
        if (catalogoProductos.length === 0) {
            showToast('No hay productos en el catálogo todavía.', 'warning');
            return;
        }
        agregarLineaVenta();
    });
}

const btnRegistrarVenta = document.getElementById('btnRegistrarVenta');
if (btnRegistrarVenta) {
    btnRegistrarVenta.addEventListener('click', async () => {
        const idCliente = document.getElementById('selectClienteVenta').value;
        if (!idCliente) {
            showToast('Selecciona un cliente para la venta.', 'warning');
            return;
        }

        const items = [];
        document.querySelectorAll('#lineasVenta tr').forEach(tr => {
            const idProducto = tr.querySelector('.linea-producto').value;
            const cantidad = Number(tr.querySelector('.linea-cantidad').value);
            if (idProducto && cantidad > 0) {
                items.push({ idProducto: Number(idProducto), cantidad });
            }
        });

        if (items.length === 0) {
            showToast('Agrega al menos un producto a la venta.', 'warning');
            return;
        }

        btnRegistrarVenta.disabled = true;
        try {
            const resp = await authFetch('/api/ventas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idCliente: Number(idCliente), items })
            });
            const data = await resp.json();

            if (data.ok && (!data.errores || data.errores.length === 0)) {
                showToast(`Venta #${data.idVenta} registrada exitosamente`, 'success');
            } else if (data.ok) {
                Swal.fire({
                    title: `Venta #${data.idVenta} creada con observaciones`,
                    html: data.errores.map(e => `<div>${e}</div>`).join(''),
                    icon: 'warning',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)'
                });
            } else {
                showToast(data.mensaje, 'error');
            }

            document.getElementById('selectClienteVenta').value = '';
            document.getElementById('lineasVenta').innerHTML = '';
            recalcularTotalVenta();
            cargarProductosParaVenta();
            cargarProductos();
            if (isAdmin) cargarVentasAdmin();
        } catch (err) {
            showToast('No se pudo conectar con el servidor', 'error');
        } finally {
            btnRegistrarVenta.disabled = false;
        }
    });
}

async function cargarVentasAdmin() {
    try {
        const resp = await authFetch('/api/ventas');
        const data = await resp.json();

        if (dtVentasAdmin) dtVentasAdmin.destroy();
        const tbody = document.getElementById('tablaVentasAdmin');
        tbody.innerHTML = '';

        if (!data.ok) return;

        if (data.ventas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-state">
                <i data-lucide="shopping-cart" class="empty-icon"></i>
                <p>Todavía no hay ventas registradas</p>
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
                <td><strong>$${Number(v.TOTAL).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</strong></td>
                <td class="actions" style="text-align:right">
                    <button class="btn-secondary btn-icon" onclick="verDetalleVenta(${v.ID_VENTA})" title="Ver detalle">
                        <i data-lucide="eye" style="width:16px;height:16px"></i>
                    </button>
                    <button class="btn-danger btn-icon" onclick="eliminarVenta(${v.ID_VENTA})" title="Eliminar">
                        <i data-lucide="trash-2" style="width:16px;height:16px"></i>
                    </button>
                </td>`;
            tbody.appendChild(tr);
        });

        lucide.createIcons();
        dtVentasAdmin = $('#tablaVentasAdminDt').DataTable(dtConfig);
    } catch (err) {
        showToast('Error cargando las ventas', 'error');
    }
}

window.verDetalleVenta = async function(idVenta) {
    try {
        const resp = await authFetch(`/api/ventas/${idVenta}/detalle`);
        const data = await resp.json();
        if (!data.ok) { showToast(data.mensaje, 'error'); return; }

        const filas = data.detalle.map(d => `
            <tr>
                <td style="text-align:left;padding:4px 8px;">${d.PRODUCTO}</td>
                <td style="padding:4px 8px;">${d.CANTIDAD}</td>
                <td style="padding:4px 8px;">$${Number(d.PRECIO_UNITARIO).toFixed(2)}</td>
                <td style="padding:4px 8px;">$${Number(d.SUBTOTAL).toFixed(2)}</td>
            </tr>`).join('');

        Swal.fire({
            title: `Detalle de la venta #${idVenta}`,
            html: `<table style="width:100%; font-size:13px;">
                     <thead><tr>
                        <th style="text-align:left;padding:4px 8px;">Producto</th>
                        <th style="padding:4px 8px;">Cant.</th>
                        <th style="padding:4px 8px;">P. Unit.</th>
                        <th style="padding:4px 8px;">Subtotal</th>
                     </tr></thead>
                     <tbody>${filas}</tbody>
                   </table>`,
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            confirmButtonText: 'Cerrar'
        });
    } catch (err) {
        showToast('No se pudo cargar el detalle de la venta', 'error');
    }
}

window.eliminarVenta = async function(idVenta) {
    Swal.fire({
        title: '¿Eliminar venta?',
        text: 'Se eliminará la venta completa y se restituirá el stock de sus productos.',
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
                const resp = await authFetch(`/api/ventas/${idVenta}`, { method: 'DELETE' });
                const data = await resp.json();
                if (data.ok) {
                    showToast('Venta eliminada y stock restituido', 'success');
                    cargarVentasAdmin();
                    cargarProductosParaVenta();
                } else {
                    showToast(data.mensaje, 'error');
                }
            } catch (err) {
                showToast('Error al conectar con el servidor', 'error');
            }
        }
    });
}

// ==================== GESTION DE USUARIOS (solo ADMIN) ====================
async function cargarUsuarios() {
    try {
        const resp = await authFetch('/api/usuarios');
        const data = await resp.json();

        if (dtUsuarios) dtUsuarios.destroy();
        const tbody = document.getElementById('tablaUsuarios');
        tbody.innerHTML = '';

        if (!data.ok) return;

        data.usuarios.forEach(u => {
            const esYo = u.ID_USUARIO === usuario.id;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge badge-info">#${u.ID_USUARIO}</span></td>
                <td><strong>${u.USERNAME}</strong>${esYo ? ' <span style="opacity:0.6">(tú)</span>' : ''}</td>
                <td>${u.NOMBRE_COMPLETO || '<span style="opacity:0.5">-</span>'}</td>
                <td><span class="badge ${u.ROL === 'ADMIN' ? 'badge-info' : 'badge-success'}">${u.ROL}</span></td>
                <td><span class="badge ${u.ACTIVO === 1 ? 'badge-success' : 'badge-danger'}">${u.ACTIVO === 1 ? 'Activo' : 'Inactivo'}</span></td>
                <td class="actions" style="text-align:right">
                    <button class="btn-secondary btn-sm" onclick="cambiarRolUsuario(${u.ID_USUARIO}, '${u.ROL}')" ${esYo ? 'disabled title="No puedes cambiar tu propio rol"' : 'title="Cambiar rol"'}>
                        <i data-lucide="shield" style="width:14px;height:14px"></i> ${u.ROL === 'ADMIN' ? 'Quitar admin' : 'Hacer admin'}
                    </button>
                    <button class="btn-secondary btn-sm" onclick="cambiarEstadoUsuario(${u.ID_USUARIO}, ${u.ACTIVO})" ${esYo ? 'disabled title="No puedes desactivar tu propia cuenta"' : ''}>
                        <i data-lucide="power" style="width:14px;height:14px"></i> ${u.ACTIVO === 1 ? 'Desactivar' : 'Activar'}
                    </button>
                </td>`;
            tbody.appendChild(tr);
        });

        lucide.createIcons();
        dtUsuarios = $('#tablaUsuariosDt').DataTable(dtConfig);
    } catch (err) {
        showToast('Error cargando los usuarios', 'error');
    }
}

window.cambiarRolUsuario = async function(id, rolActual) {
    const nuevoRol = rolActual === 'ADMIN' ? 'USUARIO' : 'ADMIN';
    Swal.fire({
        title: `¿Cambiar a ${nuevoRol}?`,
        text: `Este usuario pasará a tener el rol ${nuevoRol}.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, cambiar',
        cancelButtonText: 'Cancelar',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)'
    }).then(async (result) => {
        if (!result.isConfirmed) return;
        try {
            const resp = await authFetch(`/api/usuarios/${id}/rol`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rol: nuevoRol })
            });
            const data = await resp.json();
            if (data.ok) {
                showToast('Rol actualizado', 'success');
                cargarUsuarios();
            } else {
                showToast(data.mensaje, 'error');
            }
        } catch (err) {
            showToast('Error al conectar con el servidor', 'error');
        }
    });
}

window.cambiarEstadoUsuario = async function(id, activoActual) {
    const nuevoEstado = activoActual === 1 ? 0 : 1;
    try {
        const resp = await authFetch(`/api/usuarios/${id}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: nuevoEstado })
        });
        const data = await resp.json();
        if (data.ok) {
            showToast(nuevoEstado === 1 ? 'Usuario activado' : 'Usuario desactivado', 'success');
            cargarUsuarios();
        } else {
            showToast(data.mensaje, 'error');
        }
    } catch (err) {
        showToast('Error al conectar con el servidor', 'error');
    }
}

// -------------------- Carga Inicial --------------------
setTimeout(() => {
    cargarClientes();
}, 500);
