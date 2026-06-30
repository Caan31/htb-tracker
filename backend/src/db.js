// ------------------------------------------------------------
//  Conexión a PostgreSQL
// ------------------------------------------------------------
// Usamos un "Pool": un conjunto de conexiones reutilizables.
// En vez de abrir y cerrar una conexión por cada petición (lento),
// el pool las mantiene listas y las reparte entre las peticiones.
const { Pool } = require('pg');

const pool = new Pool({
  // DATABASE_URL llega como variable de entorno desde docker-compose.
  // Formato: postgres://usuario:password@host:puerto/basededatos
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});

// Exponemos un helper "query" para no repetir pool.query por todos lados.
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
