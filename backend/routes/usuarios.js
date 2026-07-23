// routes/usuarios.js
const express = require('express');
const router = express.Router();
const { getConnection, oracledb } = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

// Toda esta ruta es exclusiva de ADMIN.
router.use(requireAdmin);

// GET /api/usuarios -> lista todos los usuarios del sistema
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN SP_USUARIO_SELECT_ALL(:o_cursor); END;`,
            { o_cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR } }
        );
        const rows = await result.outBinds.o_cursor.getRows();
        await result.outBinds.o_cursor.close();
        res.json({ ok: true, usuarios: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al listar usuarios.' });
    } finally {
        if (conn) await conn.close();
    }
});

// PUT /api/usuarios/:id/rol -> cambia el rol de un usuario (ADMIN | USUARIO)
router.put('/:id/rol', async (req, res) => {
    const { rol } = req.body;
    if (!rol || !['ADMIN', 'USUARIO'].includes(String(rol).toUpperCase())) {
        return res.status(400).json({ ok: false, mensaje: 'Rol invalido. Use ADMIN o USUARIO.' });
    }

    // No permitir que un admin se quite su propio rol de admin por error,
    // dejando el sistema sin ningun administrador activo.
    if (req.user.id === Number(req.params.id) && String(rol).toUpperCase() !== 'ADMIN') {
        return res.status(400).json({ ok: false, mensaje: 'No puedes quitarte tu propio rol de administrador.' });
    }

    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN SP_USUARIO_CAMBIAR_ROL(:p_id, :p_rol, :o_estado); END;`,
            {
                p_id: req.params.id,
                p_rol: rol,
                o_estado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 300 }
            }
        );
        const estado = result.outBinds.o_estado;
        if (estado === 'OK') return res.json({ ok: true, mensaje: 'Rol actualizado.' });
        if (estado === 'NO_ENCONTRADO') return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado.' });
        res.status(400).json({ ok: false, mensaje: estado });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al cambiar el rol.' });
    } finally {
        if (conn) await conn.close();
    }
});

// PUT /api/usuarios/:id/estado -> activa/desactiva un usuario
router.put('/:id/estado', async (req, res) => {
    const { activo } = req.body;
    if (activo !== 0 && activo !== 1) {
        return res.status(400).json({ ok: false, mensaje: 'El estado debe ser 0 o 1.' });
    }

    if (req.user.id === Number(req.params.id) && activo === 0) {
        return res.status(400).json({ ok: false, mensaje: 'No puedes desactivar tu propia cuenta.' });
    }

    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN SP_USUARIO_CAMBIAR_ESTADO(:p_id, :p_activo, :o_estado); END;`,
            {
                p_id: req.params.id,
                p_activo: activo,
                o_estado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 300 }
            }
        );
        const estado = result.outBinds.o_estado;
        if (estado === 'OK') return res.json({ ok: true, mensaje: 'Estado actualizado.' });
        if (estado === 'NO_ENCONTRADO') return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado.' });
        res.status(400).json({ ok: false, mensaje: estado });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al cambiar el estado.' });
    } finally {
        if (conn) await conn.close();
    }
});

module.exports = router;
