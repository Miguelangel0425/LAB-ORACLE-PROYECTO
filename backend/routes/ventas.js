// routes/ventas.js
const express = require('express');
const router = express.Router();
const { getConnection, oracledb } = require('../config/db');

// GET /api/ventas/totales/:idCliente -> ventas totales de un cliente (SP_VENTAS_TOTALES_CLIENTE)
router.get('/totales/:idCliente', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN SP_VENTAS_TOTALES_CLIENTE(:p_id, :o_total, :o_num); END;`,
            {
                p_id: req.params.idCliente,
                o_total: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                o_num: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
            }
        );
        const { o_total, o_num } = result.outBinds;
        res.json({ ok: true, totalComprado: o_total, numeroVentas: o_num });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al consultar ventas totales.' });
    } finally {
        if (conn) await conn.close();
    }
});

// GET /api/ventas/rango?inicio=YYYY-MM-DD&fin=YYYY-MM-DD (SP_VENTAS_RANGO_FECHAS)
router.get('/rango', async (req, res) => {
    const { inicio, fin } = req.query;
    if (!inicio || !fin) {
        return res.status(400).json({ ok: false, mensaje: 'Debe indicar fecha de inicio y fin.' });
    }
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN SP_VENTAS_RANGO_FECHAS(TO_DATE(:p_inicio,'YYYY-MM-DD'), TO_DATE(:p_fin,'YYYY-MM-DD'), :o_cursor); END;`,
            {
                p_inicio: inicio,
                p_fin: fin,
                o_cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR }
            }
        );
        const rows = await result.outBinds.o_cursor.getRows();
        await result.outBinds.o_cursor.close();
        res.json({ ok: true, ventas: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al consultar ventas por rango de fechas.' });
    } finally {
        if (conn) await conn.close();
    }
});

module.exports = router;
