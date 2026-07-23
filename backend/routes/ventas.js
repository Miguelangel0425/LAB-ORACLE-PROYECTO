// routes/ventas.js
const express = require('express');
const router = express.Router();
const { getConnection, oracledb } = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

// -------------------------------------------------------------------------
// Consultas de Ventas (totales por cliente / rango de fechas): son reportes
// de negocio -- exclusivas de ADMIN. Un USUARIO normal solo opera (vende),
// no ve cifras consolidadas de ingresos.
// -------------------------------------------------------------------------

// GET /api/ventas/totales/:idCliente -> ventas totales de un cliente (SP_VENTAS_TOTALES_CLIENTE)
router.get('/totales/:idCliente', requireAdmin, async (req, res) => {
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
router.get('/rango', requireAdmin, async (req, res) => {
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

// -------------------------------------------------------------------------
// Listado/detalle/eliminacion de ventas: tambien exclusivo de ADMIN (es
// gestion/supervision, no la operacion diaria de vender).
// -------------------------------------------------------------------------

// GET /api/ventas -> lista todos los encabezados de venta
router.get('/', requireAdmin, async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN SP_VENTA_SELECT_ALL(:o_cursor); END;`,
            { o_cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR } }
        );
        const rows = await result.outBinds.o_cursor.getRows();
        await result.outBinds.o_cursor.close();
        res.json({ ok: true, ventas: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al listar las ventas.' });
    } finally {
        if (conn) await conn.close();
    }
});

// GET /api/ventas/:id/detalle -> lineas de producto de una venta
router.get('/:id/detalle', requireAdmin, async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN SP_VENTA_SELECT_DETALLE(:p_id, :o_cursor); END;`,
            {
                p_id: req.params.id,
                o_cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR }
            }
        );
        const rows = await result.outBinds.o_cursor.getRows();
        await result.outBinds.o_cursor.close();
        res.json({ ok: true, detalle: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al obtener el detalle de la venta.' });
    } finally {
        if (conn) await conn.close();
    }
});

// -------------------------------------------------------------------------
// Registrar una venta nueva: la operacion diaria en si -- disponible para
// CUALQUIER usuario autenticado (ADMIN o USUARIO). El vendedor (ID_USUARIO)
// se toma SIEMPRE de la sesion autenticada (req.user.id), nunca de lo que
// mande el cliente en el body -- asi nadie puede "vender a nombre de otro".
// -------------------------------------------------------------------------

// POST /api/ventas -> registra una venta nueva con sus lineas
// Body: { idCliente, items: [{ idProducto, cantidad }, ...] }
router.post('/', async (req, res) => {
    const { idCliente, items } = req.body;

    if (!idCliente || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ ok: false, mensaje: 'Debe indicar un cliente y al menos un producto.' });
    }

    let conn;
    try {
        conn = await getConnection();

        // 1) Crear el encabezado (valida cliente activo y registra vendedor)
        const encabezado = await conn.execute(
            `BEGIN SP_VENTA_INSERT_ENCABEZADO(:p_id_cliente, :p_id_vendedor, :o_id_venta, :o_estado); END;`,
            {
                p_id_cliente: idCliente,
                p_id_vendedor: req.user.id,
                o_id_venta: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                o_estado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 300 }
            }
        );

        if (encabezado.outBinds.o_estado !== 'OK') {
            return res.status(400).json({ ok: false, mensaje: encabezado.outBinds.o_estado });
        }

        const idVenta = encabezado.outBinds.o_id_venta;

        // 2) Agregar cada linea (una por una; si alguna falla -- ej. stock
        //    insuficiente -- se informa cual, sin deshacer las anteriores,
        //    ya que cada linea ya quedo confirmada por su propio COMMIT)
        const errores = [];
        for (const item of items) {
            const detalle = await conn.execute(
                `BEGIN SP_VENTA_DETALLE_INSERT(:p_id_venta, :p_id_producto, :p_cantidad, :o_estado); END;`,
                {
                    p_id_venta: idVenta,
                    p_id_producto: item.idProducto,
                    p_cantidad: item.cantidad,
                    o_estado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 300 }
                }
            );
            if (detalle.outBinds.o_estado !== 'OK') {
                errores.push(`Producto ${item.idProducto}: ${detalle.outBinds.o_estado}`);
            }
        }

        if (errores.length > 0) {
            return res.status(207).json({
                ok: true,
                idVenta,
                mensaje: 'Venta creada, pero algunas lineas no se pudieron agregar.',
                errores
            });
        }

        res.status(201).json({ ok: true, idVenta });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al registrar la venta.' });
    } finally {
        if (conn) await conn.close();
    }
});

// DELETE /api/ventas/:id -> elimina una venta completa y restituye stock. Solo ADMIN.
router.delete('/:id', requireAdmin, async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN SP_VENTA_DELETE(:p_id, :p_id_elimina, :o_estado); END;`,
            {
                p_id: req.params.id,
                p_id_elimina: req.user.id,
                o_estado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 300 }
            }
        );
        const estado = result.outBinds.o_estado;
        if (estado === 'OK') return res.json({ ok: true, mensaje: 'Venta eliminada y stock restituido.' });
        if (estado === 'NO_ENCONTRADO') return res.status(404).json({ ok: false, mensaje: 'Venta no encontrada.' });
        res.status(400).json({ ok: false, mensaje: estado });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al eliminar la venta.' });
    } finally {
        if (conn) await conn.close();
    }
});

module.exports = router;
