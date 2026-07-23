// routes/productos.js
const express = require('express');
const router = express.Router();
const { getConnection, oracledb } = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

// Listar y crear productos: disponible para CUALQUIER usuario autenticado
// (un USUARIO normal necesita ver el catalogo y agregar productos nuevos
// para poder vender). Editar y eliminar quedan exclusivos de ADMIN mas abajo.

// GET /api/productos -> lista todos los productos
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN SP_PRODUCTO_SELECT_ALL(:o_cursor); END;`,
            { o_cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR } }
        );
        const rows = await result.outBinds.o_cursor.getRows();
        await result.outBinds.o_cursor.close();
        res.json({ ok: true, productos: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al listar productos.' });
    } finally {
        if (conn) await conn.close();
    }
});

// GET /api/productos/:id
router.get('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN SP_PRODUCTO_SELECT_BY_ID(:p_id, :o_cursor); END;`,
            {
                p_id: req.params.id,
                o_cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR }
            }
        );
        const rows = await result.outBinds.o_cursor.getRows();
        await result.outBinds.o_cursor.close();
        if (rows.length === 0) {
            return res.status(404).json({ ok: false, mensaje: 'Producto no encontrado.' });
        }
        res.json({ ok: true, producto: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al obtener el producto.' });
    } finally {
        if (conn) await conn.close();
    }
});

// POST /api/productos -> crea un producto (dispara TRG_PRODUCTOS_BI)
router.post('/', async (req, res) => {
    const { nombre, descripcion, precio, stock } = req.body;
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN
                SP_PRODUCTO_INSERT(:p_nombre, :p_descripcion, :p_precio, :p_stock, :o_id, :o_estado);
             END;`,
            {
                p_nombre: nombre,
                p_descripcion: descripcion,
                p_precio: precio,
                p_stock: stock,
                o_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                o_estado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 300 }
            }
        );
        const { o_id, o_estado } = result.outBinds;
        if (o_estado === 'OK') return res.status(201).json({ ok: true, idProducto: o_id });
        res.status(400).json({ ok: false, mensaje: o_estado });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al crear el producto.' });
    } finally {
        if (conn) await conn.close();
    }
});

// PUT /api/productos/:id -> actualiza un producto. Solo ADMIN.
router.put('/:id', requireAdmin, async (req, res) => {
    const { nombre, descripcion, precio, stock } = req.body;
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN
                SP_PRODUCTO_UPDATE(:p_id, :p_nombre, :p_descripcion, :p_precio, :p_stock, :o_estado);
             END;`,
            {
                p_id: req.params.id,
                p_nombre: nombre,
                p_descripcion: descripcion,
                p_precio: precio,
                p_stock: stock,
                o_estado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 300 }
            }
        );
        const estado = result.outBinds.o_estado;
        if (estado === 'OK') return res.json({ ok: true, mensaje: 'Producto actualizado.' });
        if (estado === 'NO_ENCONTRADO') return res.status(404).json({ ok: false, mensaje: 'Producto no encontrado.' });
        res.status(400).json({ ok: false, mensaje: estado });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al actualizar el producto.' });
    } finally {
        if (conn) await conn.close();
    }
});

// DELETE /api/productos/:id -> solo ADMIN (dispara TRG_PRODUCTOS_BD si tiene ventas)
router.delete('/:id', requireAdmin, async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN SP_PRODUCTO_DELETE(:p_id, :o_estado); END;`,
            {
                p_id: req.params.id,
                o_estado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 300 }
            }
        );
        const estado = result.outBinds.o_estado;
        if (estado === 'OK') return res.json({ ok: true, mensaje: 'Producto eliminado.' });
        res.status(409).json({ ok: false, mensaje: estado });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al eliminar el producto.' });
    } finally {
        if (conn) await conn.close();
    }
});

module.exports = router;
