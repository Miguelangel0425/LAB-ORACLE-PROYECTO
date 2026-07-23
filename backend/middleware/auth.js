// middleware/auth.js
const { getSession } = require('../config/sessions');

// Exige un token valido (Authorization: Bearer <token>). Si es valido,
// deja los datos del usuario en req.user para que las rutas y el
// middleware requireAdmin los puedan usar.
function requireAuth(req, res, next) {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ ok: false, mensaje: 'No autenticado. Inicia sesion nuevamente.' });
    }

    const session = getSession(token);
    if (!session) {
        return res.status(401).json({ ok: false, mensaje: 'Sesion invalida o expirada. Inicia sesion nuevamente.' });
    }

    req.user = session;
    next();
}

// Debe usarse DESPUES de requireAuth. Rechaza con 403 si el usuario
// autenticado no tiene rol ADMIN.
function requireAdmin(req, res, next) {
    if (!req.user || req.user.rol !== 'ADMIN') {
        return res.status(403).json({ ok: false, mensaje: 'Esta accion requiere rol de administrador.' });
    }
    next();
}

module.exports = { requireAuth, requireAdmin };
