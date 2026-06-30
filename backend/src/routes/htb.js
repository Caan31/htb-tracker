// ------------------------------------------------------------
//  Rutas: /api/htb   (integración con la API de HackTheBox)
// ------------------------------------------------------------
//  Flujo:
//   1) Guardas tu App Token (lo generas en HTB -> Profile Settings -> App Tokens)
//   2) Al sincronizar, leemos tu actividad en HTB y marcamos como
//      "Completada" las máquinas tuyas que aparezcan resueltas.
// ------------------------------------------------------------
const express = require('express');
const router = express.Router();
const { query } = require('../db');

const HTB_BASE = 'https://labs.hackthebox.com/api/v4';

// --- Aseguramos que exista la tabla de configuración (1 sola fila) ---
async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS htb_config (
      id                 INT PRIMARY KEY DEFAULT 1,
      app_token          TEXT,
      usuario_htb_id     INT,
      usuario_htb_nombre VARCHAR(100),
      ultimo_sync        TIMESTAMPTZ,
      maquinas_resueltas INT,
      CONSTRAINT solo_una_fila CHECK (id = 1)
    )
  `);
}
ensureTable().catch((e) => console.error('No se pudo crear htb_config:', e));

async function getConfig() {
  const { rows } = await query('SELECT * FROM htb_config WHERE id = 1');
  return rows[0] || null;
}

// Llamada GET a la API de HTB con el token
async function htbGet(path, token) {
  const res = await fetch(`${HTB_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': 'HTB-Tracker',
    },
  });
  if (res.status === 401) { const e = new Error('Token inválido o caducado'); e.status = 401; throw e; }
  if (!res.ok) { const e = new Error(`HTB respondió ${res.status}`); e.status = res.status; throw e; }
  return res.json();
}

// POST /api/htb/authenticate  { app_token }
// Valida el token contra HTB y guarda tu id/nombre.
router.post('/authenticate', async (req, res, next) => {
  try {
    const { app_token } = req.body;
    if (!app_token) return res.status(400).json({ error: 'Falta el app_token' });

    let info;
    try {
      const data = await htbGet('/user/info', app_token);
      info = data.info || data; // la API envuelve en {info:{...}}
    } catch (e) {
      return res.status(e.status === 401 ? 401 : 502).json({ error: e.message });
    }

    await query(`
      INSERT INTO htb_config (id, app_token, usuario_htb_id, usuario_htb_nombre)
      VALUES (1, $1, $2, $3)
      ON CONFLICT (id) DO UPDATE
        SET app_token = $1, usuario_htb_id = $2, usuario_htb_nombre = $3
    `, [app_token, info.id, info.name]);

    res.json({ usuario: info.name, usuario_htb_id: info.id });
  } catch (err) { next(err); }
});

// GET /api/htb/status
router.get('/status', async (req, res, next) => {
  try {
    const cfg = await getConfig();
    if (!cfg || !cfg.app_token) return res.json({ configurado: false });
    res.json({
      configurado: true,
      usuario: cfg.usuario_htb_nombre,
      usuario_htb_id: cfg.usuario_htb_id,
      ultimo_sync: cfg.ultimo_sync,
      maquinas_resueltas: cfg.maquinas_resueltas,
    });
  } catch (err) { next(err); }
});

// POST /api/htb/sync
// Lee tu actividad en HTB y marca como Completada las máquinas resueltas.
router.post('/sync', async (req, res, next) => {
  try {
    const cfg = await getConfig();
    if (!cfg || !cfg.app_token) {
      return res.status(400).json({ error: 'Primero configura tu API key de HTB' });
    }

    let data;
    try {
      data = await htbGet(`/user/profile/activity/${cfg.usuario_htb_id}`, cfg.app_token);
    } catch (e) {
      return res.status(502).json({ error: `No se pudo consultar HTB: ${e.message}` });
    }

    // La actividad puede venir como {profile:{activity:[]}} o {activity:[]}
    const activity = data?.profile?.activity || data?.activity || [];

    // Nos quedamos con los nombres de las MÁQUINAS resueltas
    const resueltas = new Map(); // nombreLower -> { nombre, htb_id }
    for (const a of activity) {
      const tipo = (a.object_type || '').toLowerCase();
      const esMaquina = tipo === 'machine' || a.machine_avatar || a.machine_id;
      const nombre = a.name || a.object_name;
      if (esMaquina && nombre) {
        resueltas.set(nombre.toLowerCase(), { nombre, htb_id: a.id || a.machine_id || null });
      }
    }

    // Cruzamos con nuestras máquinas
    const { rows: maquinas } = await query('SELECT id, nombre, estado FROM maquinas');
    const porNombre = new Map(maquinas.map((m) => [m.nombre.toLowerCase(), m]));

    const actualizadas = [];
    const ya_completadas = [];
    const no_encontradas = [];

    for (const [nl, info] of resueltas) {
      const m = porNombre.get(nl);
      if (!m) { no_encontradas.push(info.nombre); continue; }
      if (m.estado === 'Completada') { ya_completadas.push(m.nombre); continue; }
      await query(`
        UPDATE maquinas
        SET estado = 'Completada',
            fecha_inicio = COALESCE(fecha_inicio, NOW()),
            fecha_completada = COALESCE(fecha_completada, NOW()),
            htb_machine_id = COALESCE(htb_machine_id, $2)
        WHERE id = $1
      `, [m.id, info.htb_id]);
      actualizadas.push(m.nombre);
    }

    await query(
      'UPDATE htb_config SET ultimo_sync = NOW(), maquinas_resueltas = $1 WHERE id = 1',
      [resueltas.size]
    );

    res.json({
      total_resueltas_htb: resueltas.size,
      nuevas_completadas: actualizadas,
      ya_estaban: ya_completadas.length,
      no_encontradas, // resueltas en HTB que no están entre tus 291 máquinas
    });
  } catch (err) { next(err); }
});

// DELETE /api/htb/api-key  -> olvida el token
router.delete('/api-key', async (req, res, next) => {
  try {
    await query('UPDATE htb_config SET app_token = NULL WHERE id = 1');
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
