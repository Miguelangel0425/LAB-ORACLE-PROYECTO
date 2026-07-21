// server.js
const express = require('express');
const path = require('path');
const { initPool, closePool } = require('./config/db');

const authRoutes = require('./routes/auth');
const clientesRoutes = require('./routes/clientes');
const ventasRoutes = require('./routes/ventas');
const reportesRoutes = require('./routes/reportes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Sirve el frontend estatico (login, registro, menu)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/reportes', reportesRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, mensaje: 'API activa.' }));

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
