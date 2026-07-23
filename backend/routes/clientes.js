// routes/clientes.js
const express = require('express');
const router = express.Router();
const { getConnection, oracledb } = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

// GET /api/clientes -> lista todos los clientes (SP_CLIENTE_SELECT_ALL)
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN SP_CLIENTE_SELECT_ALL(:o_cursor); END;`,
            { o_cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR } }
        );
        const rows = await result.outBinds.o_cursor.getRows();
        await result.outBinds.o_cursor.close();
        res.json({ ok: true, clientes: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al listar clientes.' });
    } finally {
        if (conn) await conn.close();
    }
});

// GET /api/clientes/:id -> cliente por id (SP_CLIENTE_SELECT_BY_ID)
router.get('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN SP_CLIENTE_SELECT_BY_ID(:p_id, :o_cursor); END;`,
            {
                p_id: req.params.id,
                o_cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR }
            }
        );
        const rows = await result.outBinds.o_cursor.getRows();
        await result.outBinds.o_cursor.close();
        if (rows.length === 0) {
            return res.status(404).json({ ok: false, mensaje: 'Cliente no encontrado.' });
        }
        res.json({ ok: true, cliente: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al obtener el cliente.' });
    } finally {
        if (conn) await conn.close();
    }
});

// POST /api/clientes -> crea un cliente (SP_CLIENTE_INSERT, dispara TRG_CLIENTES_BI)
router.post('/', async (req, res) => {
    const { nombre, apellido, email, telefono, direccion } = req.body;
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN
                SP_CLIENTE_INSERT(:p_nombre, :p_apellido, :p_email, :p_telefono, :p_direccion,
                                   :o_id, :o_estado);
             END;`,
            {
                p_nombre: nombre,
                p_apellido: apellido,
                p_email: email,
                p_telefono: telefono,
                p_direccion: direccion,
                o_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                o_estado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 300 }
            }
        );
        const { o_id, o_estado } = result.outBinds;
        if (o_estado === 'OK') {
            return res.status(201).json({ ok: true, idCliente: o_id });
        }
        res.status(400).json({ ok: false, mensaje: o_estado });
    } catch (err) {
        console.error(err);
        if (err.message.includes('ORA-00001')) {
            if (err.message.includes('TELEFONO')) {
                return res.status(400).json({ ok: false, mensaje: 'Error: El número de teléfono ingresado ya está registrado por otro cliente.' });
            }
            if (err.message.includes('EMAIL')) {
                return res.status(400).json({ ok: false, mensaje: 'Error: El correo electrónico ya se encuentra registrado por otro cliente.' });
            }
            return res.status(400).json({ ok: false, mensaje: 'Error: Los datos ingresados ya existen (violación de restricción única).' });
        }
        res.status(500).json({ ok: false, mensaje: 'Error al crear el cliente.' });
    } finally {
        if (conn) await conn.close();
    }
});

// PUT /api/clientes/:id -> actualiza un cliente (SP_CLIENTE_UPDATE, dispara TRG_CLIENTES_AU)
router.put('/:id', async (req, res) => {
    const { nombre, apellido, email, telefono, direccion } = req.body;
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN
                SP_CLIENTE_UPDATE(:p_id, :p_nombre, :p_apellido, :p_email, :p_telefono, :p_direccion,
                                   :o_estado);
             END;`,
            {
                p_id: req.params.id,
                p_nombre: nombre,
                p_apellido: apellido,
                p_email: email,
                p_telefono: telefono,
                p_direccion: direccion,
                o_estado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 300 }
            }
        );
        const estado = result.outBinds.o_estado;
        if (estado === 'OK') return res.json({ ok: true, mensaje: 'Cliente actualizado.' });
        if (estado === 'NO_ENCONTRADO') return res.status(404).json({ ok: false, mensaje: 'Cliente no encontrado.' });
        res.status(400).json({ ok: false, mensaje: estado });
    } catch (err) {
        console.error(err);
        if (err.message.includes('ORA-00001')) {
            if (err.message.includes('TELEFONO')) {
                return res.status(400).json({ ok: false, mensaje: 'Error: El número de teléfono ingresado ya está registrado por otro cliente.' });
            }
            if (err.message.includes('EMAIL')) {
                return res.status(400).json({ ok: false, mensaje: 'Error: El correo electrónico ya se encuentra registrado por otro cliente.' });
            }
            return res.status(400).json({ ok: false, mensaje: 'Error: Los datos ingresados ya existen (violación de restricción única).' });
        }
        res.status(500).json({ ok: false, mensaje: 'Error al actualizar el cliente.' });
    } finally {
        if (conn) await conn.close();
    }
});

// DELETE /api/clientes/:id -> elimina un cliente (SP_CLIENTE_DELETE, dispara TRG_CLIENTES_BD)
router.delete('/:id', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN SP_CLIENTE_DELETE(:p_id, :o_estado); END;`,
            {
                p_id: req.params.id,
                o_estado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 300 }
            }
        );
        const estado = result.outBinds.o_estado;
        if (estado === 'OK') return res.json({ ok: true, mensaje: 'Cliente eliminado.' });
        // Si el cliente tiene ventas asociadas, el trigger TRG_CLIENTES_BD
        // lanza un RAISE_APPLICATION_ERROR que llega aqui como 'ERROR: ...'
        res.status(409).json({ ok: false, mensaje: estado });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al eliminar el cliente.' });
    } finally {
        if (conn) await conn.close();
    }
});

// PUT /api/clientes/:id/estado -> activa/desactiva un cliente (soft-delete). Solo ADMIN.
router.put('/:id/estado', requireAdmin, async (req, res) => {
    const { activo } = req.body;
    if (activo !== 0 && activo !== 1) {
        return res.status(400).json({ ok: false, mensaje: 'El estado debe ser 0 o 1.' });
    }
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN SP_CLIENTE_CAMBIAR_ESTADO(:p_id, :p_activo, :o_estado); END;`,
            {
                p_id: req.params.id,
                p_activo: activo,
                o_estado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 300 }
            }
        );
        const estado = result.outBinds.o_estado;
        if (estado === 'OK') return res.json({ ok: true, mensaje: 'Estado actualizado.' });
        if (estado === 'NO_ENCONTRADO') return res.status(404).json({ ok: false, mensaje: 'Cliente no encontrado.' });
        res.status(400).json({ ok: false, mensaje: estado });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al cambiar el estado del cliente.' });
    } finally {
        if (conn) await conn.close();
    }
});

module.exports = router;
