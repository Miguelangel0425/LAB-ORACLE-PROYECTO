// routes/auth.js
const express = require('express');
const router = express.Router();
const { getConnection, oracledb } = require('../config/db');
const { createSession, destroySession } = require('../config/sessions');
const { requireAuth } = require('../middleware/auth');

// POST /api/auth/login
// Body: { username, password }
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ ok: false, mensaje: 'Usuario y contrasena son obligatorios.' });
    }

    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN
                SP_LOGIN(:p_username, :p_password, :o_estado, :o_id_usuario, :o_nombre, :o_rol);
             END;`,
            {
                p_username: username,
                p_password: password,
                o_estado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 30 },
                o_id_usuario: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                o_nombre: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 150 },
                o_rol: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 20 }
            }
        );

        const { o_estado, o_id_usuario, o_nombre, o_rol } = result.outBinds;

        if (o_estado === 'OK') {
            const usuario = { id: o_id_usuario, username, nombre: o_nombre, rol: o_rol };
            const token = createSession(usuario);
            return res.json({ ok: true, token, usuario });
        }
        if (o_estado === 'INACTIVO') {
            return res.status(403).json({ ok: false, mensaje: 'El usuario esta inactivo.' });
        }
        return res.status(401).json({ ok: false, mensaje: 'Usuario o contrasena incorrectos.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error interno al iniciar sesion.' });
    } finally {
        if (conn) await conn.close();
    }
});

// POST /api/auth/register
// Body: { username, password, nombreCompleto }
// El rol SIEMPRE queda como 'USUARIO' (lo fuerza SP_REGISTRO_USUARIO en la
// base de datos); esta ruta no acepta ni reenvia ningun campo de rol.
router.post('/register', async (req, res) => {
    const { username, password, nombreCompleto } = req.body;

    if (!username || !password) {
        return res.status(400).json({ ok: false, mensaje: 'Usuario y contrasena son obligatorios.' });
    }

    let conn;
    try {
        conn = await getConnection();
        const result = await conn.execute(
            `BEGIN
                SP_REGISTRO_USUARIO(:p_username, :p_password, :p_nombre, :o_estado);
             END;`,
            {
                p_username: username,
                p_password: password,
                p_nombre: nombreCompleto || username,
                o_estado: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 200 }
            }
        );

        const estado = result.outBinds.o_estado;

        if (estado === 'OK') {
            return res.status(201).json({ ok: true, mensaje: 'Usuario registrado correctamente.' });
        }
        if (estado === 'USUARIO_DUPLICADO') {
            return res.status(409).json({ ok: false, mensaje: 'El usuario ya existe.' });
        }
        return res.status(500).json({ ok: false, mensaje: estado });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error interno al registrar el usuario.' });
    } finally {
        if (conn) await conn.close();
    }
});

// POST /api/auth/logout -> invalida el token actual
router.post('/logout', requireAuth, (req, res) => {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) destroySession(token);
    res.json({ ok: true });
});

module.exports = router;
