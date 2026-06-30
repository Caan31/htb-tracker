// ------------------------------------------------------------
//  Rutas: /api/certificaciones
// ------------------------------------------------------------
const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/certificaciones
// Todas las certificaciones, con el número de máquinas asociadas.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT c.*,
             COUNT(mc.maquina_id) AS total_maquinas
      FROM certificaciones c
      LEFT JOIN maquina_certificacion mc ON mc.certificacion_id = c.id
      GROUP BY c.id
      ORDER BY c.id
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/certificaciones/:id
// Detalle de una certificación + sus 3 niveles.
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const cert = await query('SELECT * FROM certificaciones WHERE id = $1', [id]);
    if (cert.rows.length === 0) {
      return res.status(404).json({ error: 'Certificación no encontrada' });
    }
    const niveles = await query(
      'SELECT * FROM niveles WHERE certificacion_id = $1 ORDER BY numero_nivel',
      [id]
    );
    res.json({ ...cert.rows[0], niveles: niveles.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
