// ------------------------------------------------------------
//  Punto de entrada de la API (Express)
// ------------------------------------------------------------
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const certificaciones = require('./routes/certificaciones');
const maquinas = require('./routes/maquinas');
const vulnerabilidades = require('./routes/vulnerabilidades');
const stats = require('./routes/stats');
const dashboard = require('./routes/dashboard');
const search = require('./routes/search');
const htb = require('./routes/htb');

const app = express();

// --- Middlewares globales ---
app.use(cors());           // permite que el frontend (otro puerto) llame a la API
app.use(express.json());   // entiende cuerpos en formato JSON
app.use(morgan('dev'));    // imprime un log por cada petición recibida

// --- Healthcheck: comprobar que la API está viva ---
app.get('/api/health', (req, res) => {
  res.json({ ok: true, servicio: 'htb-tracker-api' });
});

// --- Rutas de la aplicación ---
app.use('/api/certificaciones', certificaciones);
app.use('/api/maquinas', maquinas);
app.use('/api/vulnerabilidades', vulnerabilidades);
app.use('/api/stats', stats);
app.use('/api/dashboard', dashboard);
app.use('/api/search', search);
app.use('/api/htb', htb);

// --- 404: ninguna ruta coincidió ---
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// --- Manejador central de errores ---
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 API HTB Tracker escuchando en el puerto ${PORT}`);
});
