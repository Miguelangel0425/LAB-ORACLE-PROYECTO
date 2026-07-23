// config/sessions.js
// Almacen de sesiones EN MEMORIA (se pierde si el servidor se reinicia).
// Suficiente para el alcance de este proyecto academico: SP_LOGIN ya valida
// usuario/contrasena contra Oracle; esto solo emite un token opaco para que
// el backend pueda saber, en cada peticion posterior, QUIEN esta llamando y
// CON QUE ROL, sin tener que volver a mandar la contrasena en cada request.

const crypto = require('crypto');

const sessions = new Map(); // token -> { id, username, nombre, rol, createdAt }

function createSession(usuario) {
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, { ...usuario, createdAt: Date.now() });
    return token;
}

function getSession(token) {
    return sessions.get(token);
}

function destroySession(token) {
    sessions.delete(token);
}

module.exports = { createSession, getSession, destroySession };
