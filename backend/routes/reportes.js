// routes/reportes.js
const express = require('express');
const router = express.Router();
const { getConnection } = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

// Todos los reportes son informacion consolidada de negocio: exclusivos de ADMIN.
router.use(requireAdmin);

// GET /api/reportes/ventas-totales-cliente -> VW_VENTAS_TOTALES_CLIENTE
router.get('/ventas-totales-cliente', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(`SELECT * FROM VW_VENTAS_TOTALES_CLIENTE ORDER BY ID_CLIENTE`);
        res.json({ ok: true, reporte: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al generar el reporte.' });
    } finally {
        if (conn) await conn.close();
    }
});

// GET /api/reportes/ventas-detalladas -> VW_REPORTE_VENTAS_DETALLADO
router.get('/ventas-detalladas', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(`SELECT * FROM VW_REPORTE_VENTAS_DETALLADO ORDER BY FECHA_VENTA DESC`);
        res.json({ ok: true, reporte: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al generar el reporte.' });
    } finally {
        if (conn) await conn.close();
    }
});

// GET /api/reportes/clientes-activos -> VW_CLIENTES_ACTIVOS
router.get('/clientes-activos', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(`SELECT * FROM VW_CLIENTES_ACTIVOS ORDER BY ID_CLIENTE`);
        res.json({ ok: true, reporte: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al generar el reporte.' });
    } finally {
        if (conn) await conn.close();
    }
});

module.exports = router;
