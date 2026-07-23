// server.js
const express = require('express');
const path = require('path');
const { initPool, closePool } = require('./config/db');
const { requireAuth } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const clientesRoutes = require('./routes/clientes');
const ventasRoutes = require('./routes/ventas');
const reportesRoutes = require('./routes/reportes');
const productosRoutes = require('./routes/productos');
const usuariosRoutes = require('./routes/usuarios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Sirve el frontend estatico (login, registro, menu)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/api/health', (req, res) => res.json({ ok: true, mensaje: 'API activa.' }));

// Login y registro NO requieren token (son el punto de entrada).
app.use('/api/auth', authRoutes);

// Todo lo demas requiere estar autenticado. Dentro de cada router,
// productos.js y usuarios.js ademas exigen rol ADMIN para TODAS sus rutas;
// ventas.js exige ADMIN solo para gestion (registrar/listar/eliminar), no
// para las consultas de solo lectura (totales/rango) que usa cualquier rol.
app.use('/api/clientes', requireAuth, clientesRoutes);
app.use('/api/ventas', requireAuth, ventasRoutes);
app.use('/api/reportes', requireAuth, reportesRoutes);
app.use('/api/productos', requireAuth, productosRoutes);
app.use('/api/usuarios', requireAuth, usuariosRoutes);

async function start() {
    try {
        await initPool();
        app.listen(PORT, () => {
            console.log(`Servidor escuchando en http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('No se pudo iniciar el servidor / conectar a Oracle:', err);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    await closePool();
    process.exit(0);
});

start();
