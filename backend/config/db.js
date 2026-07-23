// config/db.js
// Configuracion del pool de conexiones a Oracle Database usando node-oracledb.
// Ajusta las variables de entorno (o los valores por defecto) segun tu instancia
// local de Oracle 21c XE.

const oracledb = require('oracledb');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = false; // el commit se maneja explicitamente en los procedimientos

const dbConfig = {
    user: process.env.DB_USER || 'PROYECTO_BD',
    password: process.env.DB_PASSWORD || 'miguel1234',
    // Ejemplo con Oracle 21c XE local: 'localhost:1521/XEPDB1'
    connectString: process.env.DB_CONNECT_STRING || 'localhost:1521/XEPDB1',
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 1
};

let pool;

async function initPool() {
    if (!pool) {
        pool = await oracledb.createPool(dbConfig);
        console.log('[DB] Pool de conexiones Oracle inicializado.');
    }
    return pool;
}

async function getConnection() {
    if (!pool) {
        await initPool();
    }
    return pool.getConnection();
}

async function closePool() {
    if (pool) {
        await pool.close(10);
        pool = null;
    }
}

module.exports = { initPool, getConnection, closePool, oracledb };
