// -------------------- Sesion --------------------
const usuarioRaw = sessionStorage.getItem('usuario');
if (!usuarioRaw) {
    window.location.href = 'login.html';
}
const usuario = JSON.parse(usuarioRaw || '{}');
document.getElementById('lblUsuario').textContent = `Conectado como: ${usuario.nombre || usuario.username || ''}`;

document.getElementById('btnLogout').addEventListener('click', () => {
    sessionStorage.removeItem('usuario');
    window.location.href = 'login.html';
});

// -------------------- Navegacion entre secciones --------------------
const navItems = document.querySelectorAll('.nav-item[data-section]');
const sections = {
    crud: document.getElementById('sec-crud'),
    consultas: document.getElementById('sec-consultas'),
    reportes: document.getElementById('sec-reportes')
};

navItems.forEach(btn => {
    btn.addEventListener('click', () => {
        navItems.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Object.values(sections).forEach(s => s.classList.add('hidden'));
        sections[btn.dataset.section].classList.remove('hidden');

        if (btn.dataset.section === 'consultas') cargarSelectClientes();
        if (btn.dataset.section === 'reportes') cargarReportes();
    });
});

// -------------------- CRUD CLIENTES --------------------
const formCliente = document.getElementById('formCliente');
const mensajeCrud = document.getElementById('mensajeCrud');
const btnCancelar = document.getElementById('btnCancelar');
const formTitulo = document.getElementById('formTitulo');

async function cargarClientes() {
    const resp = await fetch('/api/clientes');
    const data = await resp.json();
    const tbody = document.getElementById('tablaClientes');
    tbody.innerHTML = '';

    if (!data.ok) return;

    data.clientes.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.ID_CLIENTE}</td>
            <td>${c.NOMBRE}</td>
            <td>${c.APELLIDO}</td>
            <td>${c.EMAIL}</td>
            <td>${c.TELEFONO || ''}</td>
            <td>${c.DIRECCION || ''}</td>
            <td class="actions">
                <button class="btn-secondary" onclick="editarCliente(${c.ID_CLIENTE})">Editar</button>
                <button class="btn-danger" onclick="eliminarCliente(${c.ID_CLIENTE})">Eliminar</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

formCliente.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensajeCrud.innerHTML = '';

    const id = document.getElementById('idCliente').value;
    const payload = {
        nombre: document.getElementById('nombre').value.trim(),
        apellido: document.getElementById('apellido').value.trim(),
        email: document.getElementById('email').value.trim(),
        telefono: document.getElementById('telefono').value.trim(),
        direccion: document.getElementById('direccion').value.trim()
    };

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
            mensajeCrud.innerHTML = `<div class="alert alert-success">Guardado correctamente.</div>`;
            resetFormulario();
            cargarClientes();
        } else {
            mensajeCrud.innerHTML = `<div class="alert alert-error">${data.mensaje}</div>`;
        }
    } catch (err) {
        mensajeCrud.innerHTML = `<div class="alert alert-error">No se pudo conectar con el servidor.</div>`;
    }
});

btnCancelar.addEventListener('click', resetFormulario);

function resetFormulario() {
    formCliente.reset();
    document.getElementById('idCliente').value = '';
    formTitulo.textContent = 'Nuevo cliente';
    btnCancelar.classList.add('hidden');
}

async function editarCliente(id) {
    const resp = await fetch(`/api/clientes/${id}`);
    const data = await resp.json();
    if (!data.ok) return;

    const c = data.cliente;
    document.getElementById('idCliente').value = c.ID_CLIENTE;
    document.getElementById('nombre').value = c.NOMBRE;
    document.getElementById('apellido').value = c.APELLIDO;
    document.getElementById('email').value = c.EMAIL;
    document.getElementById('telefono').value = c.TELEFONO || '';
    document.getElementById('direccion').value = c.DIRECCION || '';

    formTitulo.textContent = `Editar cliente #${c.ID_CLIENTE}`;
    btnCancelar.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function eliminarCliente(id) {
    if (!confirm('¿Eliminar este cliente? Esta accion no se puede deshacer.')) return;

    const resp = await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
    const data = await resp.json();

    mensajeCrud.innerHTML = data.ok
        ? `<div class="alert alert-success">Cliente eliminado.</div>`
        : `<div class="alert alert-error">${data.mensaje}</div>`;

    if (data.ok) cargarClientes();
}

// -------------------- CONSULTAS DE VENTAS --------------------
async function cargarSelectClientes() {
    const resp = await fetch('/api/clientes');
    const data = await resp.json();
    const select = document.getElementById('selectClienteVentas');
    select.innerHTML = '';

    if (!data.ok) return;
    data.clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.ID_CLIENTE;
        opt.textContent = `${c.NOMBRE} ${c.APELLIDO}`;
        select.appendChild(opt);
    });
}

document.getElementById('btnConsultarTotales').addEventListener('click', async () => {
    const idCliente = document.getElementById('selectClienteVentas').value;
    if (!idCliente) return;

    const resp = await fetch(`/api/ventas/totales/${idCliente}`);
    const data = await resp.json();
    const div = document.getElementById('resultadoTotales');

    if (data.ok) {
        div.innerHTML = `<p><strong>Numero de ventas:</strong> ${data.numeroVentas} &nbsp;|&nbsp;
                          <strong>Total comprado:</strong> $${Number(data.totalComprado).toFixed(2)}</p>`;
    } else {
        div.innerHTML = `<div class="alert alert-error">${data.mensaje}</div>`;
    }
});

document.getElementById('btnConsultarRango').addEventListener('click', async () => {
    const inicio = document.getElementById('fechaInicio').value;
    const fin = document.getElementById('fechaFin').value;
    const tbody = document.getElementById('tablaRango');
    tbody.innerHTML = '';

    if (!inicio || !fin) {
        alert('Selecciona ambas fechas.');
        return;
    }

    const resp = await fetch(`/api/ventas/rango?inicio=${inicio}&fin=${fin}`);
    const data = await resp.json();
    if (!data.ok) return;

    data.ventas.forEach(v => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${v.ID_VENTA}</td><td>${new Date(v.FECHA_VENTA).toLocaleDateString()}</td>
                         <td>${v.CLIENTE}</td><td>$${Number(v.TOTAL).toFixed(2)}</td>`;
        tbody.appendChild(tr);
    });
});

// -------------------- REPORTES --------------------
async function cargarReportes() {
    const [totales, detalle, activos] = await Promise.all([
        fetch('/api/reportes/ventas-totales-cliente').then(r => r.json()),
        fetch('/api/reportes/ventas-detalladas').then(r => r.json()),
        fetch('/api/reportes/clientes-activos').then(r => r.json())
    ]);

    const tTotales = document.getElementById('tablaReporteTotales');
    tTotales.innerHTML = '';
    if (totales.ok) {
        totales.reporte.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${r.ID_CLIENTE}</td><td>${r.NOMBRE}</td><td>${r.APELLIDO}</td>
                             <td>${r.NUMERO_VENTAS}</td><td>$${Number(r.TOTAL_COMPRADO).toFixed(2)}</td>`;
            tTotales.appendChild(tr);
        });
    }

    const tDetalle = document.getElementById('tablaReporteDetalle');
    tDetalle.innerHTML = '';
    if (detalle.ok) {
        detalle.reporte.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${r.ID_VENTA}</td><td>${new Date(r.FECHA_VENTA).toLocaleDateString()}</td>
                             <td>${r.CLIENTE}</td><td>${r.PRODUCTO}</td><td>${r.CANTIDAD}</td>
                             <td>$${Number(r.SUBTOTAL).toFixed(2)}</td><td>$${Number(r.TOTAL_VENTA).toFixed(2)}</td>`;
            tDetalle.appendChild(tr);
        });
    }

    const tClientes = document.getElementById('tablaReporteClientes');
    tClientes.innerHTML = '';
    if (activos.ok) {
        activos.reporte.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${r.ID_CLIENTE}</td><td>${r.NOMBRE}</td><td>${r.APELLIDO}</td>
                             <td>${r.EMAIL}</td><td>${new Date(r.FECHA_CREACION).toLocaleDateString()}</td>`;
            tClientes.appendChild(tr);
        });
    }
}

// Carga inicial
cargarClientes();
