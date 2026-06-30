// ------------------------------------------------------------
//  Rutas: /api/stats   (estadísticas para el dashboard y gráficos)
// ------------------------------------------------------------
const express = require('express');
const router = express.Router();
const { query } = require('../db');

// ============================================================
//  Funciones reutilizables (también las usa /api/dashboard)
// ============================================================

// Resumen general (opcionalmente filtrado por certificación)
async function getGeneral(certId) {
  if (certId) {
    const { rows } = await query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE m.estado = 'Completada')::int  AS completadas,
             COUNT(*) FILTER (WHERE m.estado = 'En Progreso')::int AS en_progreso,
             COUNT(*) FILTER (WHERE m.estado = 'Pendiente')::int   AS pendientes
      FROM maquinas m
      JOIN maquina_certificacion mc ON mc.maquina_id = m.id
      WHERE mc.certificacion_id = $1
    `, [certId]);
    return withPct(rows[0]);
  }
  const { rows } = await query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE estado = 'Completada')::int  AS completadas,
           COUNT(*) FILTER (WHERE estado = 'En Progreso')::int AS en_progreso,
           COUNT(*) FILTER (WHERE estado = 'Pendiente')::int   AS pendientes
    FROM maquinas
  `);
  return withPct(rows[0]);
}

function withPct(r) {
  return { ...r, porcentaje: r.total ? Math.round((r.completadas / r.total) * 1000) / 10 : 0 };
}

// Progreso por certificación, con desglose por nivel (incluye certs vacías)
async function getPorCertificacion() {
  const { rows } = await query(`
    SELECT c.id, c.nombre, m.nivel,
           COUNT(m.id)::int AS total,
           COUNT(m.id) FILTER (WHERE m.estado = 'Completada')::int AS completadas
    FROM certificaciones c
    LEFT JOIN maquina_certificacion mc ON mc.certificacion_id = c.id
    LEFT JOIN maquinas m ON m.id = mc.maquina_id
    GROUP BY c.id, c.nombre, m.nivel
    ORDER BY c.id
  `);

  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.id)) {
      map.set(r.id, {
        id: r.id, nombre: r.nombre, total: 0, completadas: 0,
        niveles: {
          Fundamentals: { total: 0, completadas: 0 },
          Intermediate: { total: 0, completadas: 0 },
          Advanced:     { total: 0, completadas: 0 },
        },
      });
    }
    const c = map.get(r.id);
    if (r.nivel) { // nivel null = certificación sin máquinas
      c.total += r.total;
      c.completadas += r.completadas;
      c.niveles[r.nivel] = { total: r.total, completadas: r.completadas };
    }
  }
  return [...map.values()].map((c) => withPct(c));
}

// Conteo por nivel (global)
async function getPorNivel() {
  const { rows } = await query(`
    SELECT nivel,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE estado = 'Completada')::int AS completadas
    FROM maquinas GROUP BY nivel ORDER BY nivel
  `);
  return rows;
}

// Conteo por dificultad (las sin dificultad salen como "Sin asignar")
async function getPorDificultad() {
  const { rows } = await query(`
    SELECT COALESCE(dificultad, 'Sin asignar') AS dificultad,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE estado = 'Completada')::int AS completadas
    FROM maquinas GROUP BY 1 ORDER BY 1
  `);
  return rows;
}

// Vulnerabilidades por tipo y por criticidad
async function getVulnerabilidades() {
  const porTipo = await query(`
    SELECT COALESCE(tipo, 'Sin tipo') AS tipo, COUNT(*)::int AS total
    FROM vulnerabilidades GROUP BY 1 ORDER BY total DESC
  `);
  const porCriticidad = await query(`
    SELECT COALESCE(criticidad, 'Sin asignar') AS criticidad, COUNT(*)::int AS total
    FROM vulnerabilidades GROUP BY 1 ORDER BY total DESC
  `);
  const totalRow = await query('SELECT COUNT(*)::int AS total FROM vulnerabilidades');
  return { total: totalRow.rows[0].total, por_tipo: porTipo.rows, por_criticidad: porCriticidad.rows };
}

// Máquinas completadas por día (últimos 30 días)
async function getTimeline() {
  const { rows } = await query(`
    SELECT to_char(date_trunc('day', fecha_completada), 'YYYY-MM-DD') AS dia,
           COUNT(*)::int AS total
    FROM maquinas
    WHERE estado = 'Completada' AND fecha_completada >= NOW() - INTERVAL '30 days'
    GROUP BY 1 ORDER BY 1
  `);
  return rows;
}

// Tiempo medio invertido por dificultad (solo máquinas completadas con tiempo)
async function getTiempoPromedio() {
  const { rows } = await query(`
    SELECT COALESCE(dificultad, 'Sin asignar') AS dificultad,
           ROUND(AVG(tiempo_invertido))::int AS promedio_min,
           COUNT(*) FILTER (WHERE tiempo_invertido IS NOT NULL)::int AS con_tiempo
    FROM maquinas
    WHERE estado = 'Completada'
    GROUP BY 1 ORDER BY 1
  `);
  return rows;
}

// ============================================================
//  Rutas
// ============================================================
router.get('/por-certificacion', async (req, res, next) => {
  try { res.json(await getPorCertificacion()); } catch (e) { next(e); }
});
router.get('/por-nivel', async (req, res, next) => {
  try { res.json(await getPorNivel()); } catch (e) { next(e); }
});
router.get('/por-dificultad', async (req, res, next) => {
  try { res.json(await getPorDificultad()); } catch (e) { next(e); }
});
router.get('/vulnerabilidades', async (req, res, next) => {
  try { res.json(await getVulnerabilidades()); } catch (e) { next(e); }
});
router.get('/timeline', async (req, res, next) => {
  try { res.json(await getTimeline()); } catch (e) { next(e); }
});
router.get('/tiempo-promedio', async (req, res, next) => {
  try { res.json(await getTiempoPromedio()); } catch (e) { next(e); }
});

// Resumen general (debe ir el último porque '/' es el más genérico)
router.get('/', async (req, res, next) => {
  try { res.json(await getGeneral(req.query.certificacion_id)); } catch (e) { next(e); }
});

module.exports = router;
// Exponemos las funciones para que /api/dashboard las reutilice.
module.exports.helpers = {
  getGeneral, getPorCertificacion, getPorDificultad,
  getVulnerabilidades, getTimeline,
};
