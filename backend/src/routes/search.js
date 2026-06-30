// ------------------------------------------------------------
//  Ruta: /api/search   (búsqueda global)
// ------------------------------------------------------------
// Ejemplos:
//   /api/search?q=tomcat                 -> máquinas y vulns que contengan "tomcat"
//   /api/search?tipo=RCE                 -> vulnerabilidades de tipo RCE
//   /api/search?certificacion=eJPT&estado=Completada
// ------------------------------------------------------------
const express = require('express');
const router = express.Router();
const { query } = require('../db');

router.get('/', async (req, res, next) => {
  try {
    const { q, tipo, criticidad, certificacion, estado, nivel, dificultad } = req.query;
    const result = { maquinas: [], vulnerabilidades: [] };
    const like = q ? `%${q}%` : null;

    // --- ¿Hay algún criterio que afecte a las máquinas? ---
    const buscarMaquinas = q || estado || nivel || dificultad || certificacion;
    if (buscarMaquinas) {
      const where = [];
      const params = [];
      if (q) {
        params.push(like);
        where.push(`(m.nombre ILIKE $${params.length} OR m.tecnicas ILIKE $${params.length} OR m.notas ILIKE $${params.length})`);
      }
      if (estado)     { params.push(estado);     where.push(`m.estado = $${params.length}`); }
      if (nivel)      { params.push(nivel);      where.push(`m.nivel = $${params.length}`); }
      if (dificultad) { params.push(dificultad); where.push(`m.dificultad = $${params.length}`); }
      if (certificacion) {
        params.push(certificacion);
        // acepta nombre (eJPT) o id (1)
        where.push(`EXISTS (
          SELECT 1 FROM maquina_certificacion mc
          JOIN certificaciones c ON c.id = mc.certificacion_id
          WHERE mc.maquina_id = m.id
            AND (c.nombre ILIKE $${params.length} OR c.id::text = $${params.length}))`);
      }
      const { rows } = await query(`
        SELECT m.*,
               COALESCE((
                 SELECT array_agg(c.nombre ORDER BY c.id)
                 FROM maquina_certificacion mc
                 JOIN certificaciones c ON c.id = mc.certificacion_id
                 WHERE mc.maquina_id = m.id
               ), '{}') AS certificaciones
        FROM maquinas m
        WHERE ${where.join(' AND ')}
        ORDER BY m.nombre
        LIMIT 100
      `, params);
      result.maquinas = rows;
    }

    // --- ¿Hay algún criterio que afecte a las vulnerabilidades? ---
    const buscarVulns = q || tipo || criticidad || certificacion;
    if (buscarVulns) {
      const where = [];
      const params = [];
      if (q) {
        params.push(like);
        const p = `$${params.length}`;
        where.push(`(v.titulo ILIKE ${p} OR v.cve ILIKE ${p} OR v.tipo ILIKE ${p}
                     OR v.descripcion ILIKE ${p} OR v.anotaciones ILIKE ${p} OR m.nombre ILIKE ${p})`);
      }
      if (tipo)       { params.push(tipo);       where.push(`v.tipo ILIKE $${params.length}`); }
      if (criticidad) { params.push(criticidad); where.push(`v.criticidad = $${params.length}`); }
      if (certificacion) {
        params.push(certificacion);
        where.push(`EXISTS (
          SELECT 1 FROM maquina_certificacion mc
          JOIN certificaciones c ON c.id = mc.certificacion_id
          WHERE mc.maquina_id = m.id
            AND (c.nombre ILIKE $${params.length} OR c.id::text = $${params.length}))`);
      }
      const { rows } = await query(`
        SELECT v.*, m.nombre AS maquina_nombre
        FROM vulnerabilidades v
        JOIN maquinas m ON m.id = v.maquina_id
        WHERE ${where.join(' AND ')}
        ORDER BY v.id
        LIMIT 100
      `, params);
      result.vulnerabilidades = rows;
    }

    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
