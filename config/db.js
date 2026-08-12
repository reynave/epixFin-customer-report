const sql = require('mssql');
require('dotenv').config();

// Catatan penting untuk SQL Server 2008:
// - encrypt harus false karena SQL Server 2008 gak support TLS yang dipakai driver mssql versi baru
// - trustServerCertificate juga di-set true buat jaga-jaga
// - kalau masih gagal connect, kemungkinan perlu enable TLS 1.0 di OS atau downgrade driver tedious
const baseDbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

const poolPromises = new Map();

function buildDbConfig(databaseName) {
  return {
    ...baseDbConfig,
    database: databaseName,
  };
}

function isSafeDbName(dbName) {
  return /^[A-Za-z0-9_-]+$/.test(dbName);
}

async function getPool(dbName) {
  const targetDb = (dbName || process.env.DB_DATABASE || '').trim();

  if (!targetDb) {
    throw new Error('Nama database tidak tersedia. Set DB_DATABASE atau kirim dbName via URL.');
  }

  if (!isSafeDbName(targetDb)) {
    throw new Error('Nama database tidak valid. Hanya huruf, angka, underscore, dan dash yang diperbolehkan.');
  }

  if (poolPromises.has(targetDb)) {
    return poolPromises.get(targetDb);
  }

  const pool = new sql.ConnectionPool(buildDbConfig(targetDb));
  const poolPromise = pool.connect();
  poolPromises.set(targetDb, poolPromise);

  try {
    const connectedPool = await poolPromise;
    console.log(`Berhasil konek ke SQL Server 2008 (DB: ${targetDb})`);
    return connectedPool;
  } catch (err) {
    poolPromises.delete(targetDb);
    console.error('Gagal konek ke database:', err.message);
    throw err;
  }
}

module.exports = { sql, getPool, isSafeDbName };
