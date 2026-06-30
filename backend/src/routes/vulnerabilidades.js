// ------------------------------------------------------------
//  Rutas: /api/vulnerabilidades   (editar / borrar por id)
//  (El listado y la creación van anidados bajo /api/maquinas)
// ------------------------------------------------------------
const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { CRITICIDADES } = require('../validaciones');

// PUT /api/vulnerabilidades/:id  -> editar una vulnerabilidad
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cve, titulo, tipo, criticidad, cvss, descripcion, anotaciones } = req.body;

    if (criticidad && !CRITICIDADES.includes(criticidad)) {
      return res.status(400).json({ error: `criticidad inválida (usa: ${CRITICIDADES.join(', ')})` });
    }
    if (cvss != null && (isNaN(cvss) || cvss < 0 || cvss > 10)) {
      return res.status(400).json({ error: 'cvss debe ser un número entre 0 y 10' });
    }

    // COALESCE conserva el valor actual de los campos que no se envíen.
    const { rows } = await query(`
      UPDATE vulnerabilidades SET
        cve         = COALESCE($2, cve),
        titulo      = COALESCE($3, titulo),
        tipo        = COALESCE($4, tipo),
        criticidad  = COALESCE($5, criticidad),
        cvss        = COALESCE($6, cvss),
        descripcion = COALESCE($7, descripcion),
        anotaciones = COALESCE($8, anotaciones)
      WHERE id = $1
      RETURNING *
    `, [id, cve ?? null, titulo ?? null, tipo ?? null, criticidad ?? null,
        cvss ?? null, descripcion ?? null, anotaciones ?? null]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Vulnerabilidad no encontrada' });
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/vulnerabilidades/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rowCount } = await query('DELETE FROM vulnerabilidades WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Vulnerabilidad no encontrada' });
    }
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
