// ------------------------------------------------------------
//  Rutas: /api/maquinas   (lectura + CRUD completo)
// ------------------------------------------------------------
const express = require('express');
const router = express.Router();
const { query, pool } = require('../db');
const { NIVELES, DIFICULTADES, ESTADOS, CRITICIDADES } = require('../validaciones');

// ============================================================
//  LECTURA
// ============================================================

// GET /api/maquinas
// Todas las máquinas, cada una con sus certificaciones (relación M:N).
// Filtros opcionales: ?certificacion_id=1 ?estado=Completada ?nivel=Fundamentals ?dificultad=Easy
router.get('/', async (req, res, next) => {
  try {
    const { certificacion_id, estado, nivel, dificultad } = req.query;
    const where = [];
    const params = [];

    if (certificacion_id) {
      params.push(certificacion_id);
      where.push(
        `EXISTS (SELECT 1 FROM maquina_certificacion mc
                 WHERE mc.maquina_id = m.id AND mc.certificacion_id = $${params.length})`
      );
    }
    if (estado)     { params.push(estado);     where.push(`m.estado = $${params.length}`); }
    if (nivel)      { params.push(nivel);      where.push(`m.nivel = $${params.length}`); }
    if (dificultad) { params.push(dificultad); where.push(`m.dificultad = $${params.length}`); }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const { rows } = await query(`
      SELECT m.*,
             COALESCE((
               SELECT array_agg(c.nombre ORDER BY c.id)
               FROM maquina_certificacion mc
               JOIN certificaciones c ON c.id = mc.certificacion_id
               WHERE mc.maquina_id = m.id
             ), '{}') AS certificaciones,
             (SELECT COUNT(*) FROM vulnerabilidades v WHERE v.maquina_id = m.id)::int
               AS num_vulnerabilidades
      FROM maquinas m
      ${whereSql}
      ORDER BY m.nombre
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/maquinas/:id  -> detalle + certificaciones + vulnerabilidades
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const maquina = await query('SELECT * FROM maquinas WHERE id = $1', [id]);
    if (maquina.rows.length === 0) {
      return res.status(404).json({ error: 'Máquina no encontrada' });
    }
    const certs = await query(`
      SELECT c.id, c.nombre
      FROM certificaciones c
      JOIN maquina_certificacion mc ON mc.certificacion_id = c.id
      WHERE mc.maquina_id = $1 ORDER BY c.id
    `, [id]);
    const vulns = await query(
      'SELECT * FROM vulnerabilidades WHERE maquina_id = $1 ORDER BY id', [id]
    );
    res.json({
      ...maquina.rows[0],
      certificaciones: certs.rows,
      vulnerabilidades: vulns.rows,
    });
  } catch (err) { next(err); }
});

// ============================================================
//  ESCRITURA (CRUD)
// ============================================================

// POST /api/maquinas  -> crear una máquina (y opcionalmente vincularla a certs)
// Body: { nombre*, nivel*, dificultad?, estado?, url_htb?, htb_machine_id?,
//         tecnicas?, notas?, certificaciones?: [ids] }
router.post('/', async (req, res, next) => {
  const {
    nombre, nivel, dificultad, estado, url_htb,
    htb_machine_id, tecnicas, notas, certificaciones,
  } = req.body;

  // --- Validaciones ---
  if (!nombre || !nivel) {
    return res.status(400).json({ error: 'nombre y nivel son obligatorios' });
  }
  if (!NIVELES.includes(nivel)) {
    return res.status(400).json({ error: `nivel inválido (usa: ${NIVELES.join(', ')})` });
  }
  if (dificultad && !DIFICULTADES.includes(dificultad)) {
    return res.status(400).json({ error: `dificultad inválida (usa: ${DIFICULTADES.join(', ')})` });
  }
  if (estado && !ESTADOS.includes(estado)) {
    return res.status(400).json({ error: `estado inválido (usa: ${ESTADOS.join(', ')})` });
  }

  // Usamos una transacción: o se crea todo (máquina + vínculos) o nada.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(`
      INSERT INTO maquinas (nombre, nivel, dificultad, estado, url_htb, htb_machine_id, tecnicas, notas)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [nombre, nivel, dificultad || null, estado || 'Pendiente', url_htb || null,
        htb_machine_id || null, tecnicas || null, notas || null]);

    const maquina = ins.rows[0];

    if (Array.isArray(certificaciones)) {
      for (const certId of certificaciones) {
        await client.query(
          `INSERT INTO maquina_certificacion (maquina_id, certificacion_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [maquina.id, certId]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json(maquina);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') { // nombre duplicado (UNIQUE)
      return res.status(409).json({ error: 'Ya existe una máquina con ese nombre' });
    }
    next(err);
  } finally {
    client.release();
  }
});

// PUT /api/maquinas/:id  -> editar campos de una máquina
// Si se envía "certificaciones", se reemplazan sus vínculos.
router.put('/:id', async (req, res, next) => {
  const { id } = req.params;
  const {
    nombre, nivel, dificultad, estado, url_htb,
    htb_machine_id, tecnicas, notas, tiempo_invertido, certificaciones,
  } = req.body;

  if (nivel && !NIVELES.includes(nivel)) {
    return res.status(400).json({ error: `nivel inválido (usa: ${NIVELES.join(', ')})` });
  }
  if (dificultad && !DIFICULTADES.includes(dificultad)) {
    return res.status(400).json({ error: `dificultad inválida (usa: ${DIFICULTADES.join(', ')})` });
  }
  if (estado && !ESTADOS.includes(estado)) {
    return res.status(400).json({ error: `estado inválido (usa: ${ESTADOS.join(', ')})` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // COALESCE: si un campo no se envía (undefined -> null), se conserva el valor actual.
    const upd = await client.query(`
      UPDATE maquinas SET
        nombre           = COALESCE($2, nombre),
        nivel            = COALESCE($3, nivel),
        dificultad       = COALESCE($4, dificultad),
        estado           = COALESCE($5, estado),
        url_htb          = COALESCE($6, url_htb),
        htb_machine_id   = COALESCE($7, htb_machine_id),
        tecnicas         = COALESCE($8, tecnicas),
        notas            = COALESCE($9, notas),
        tiempo_invertido = COALESCE($10, tiempo_invertido)
      WHERE id = $1
      RETURNING *
    `, [id, nombre ?? null, nivel ?? null, dificultad ?? null, estado ?? null,
        url_htb ?? null, htb_machine_id ?? null, tecnicas ?? null, notas ?? null,
        tiempo_invertido ?? null]);

    if (upd.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Máquina no encontrada' });
    }

    if (Array.isArray(certificaciones)) {
      await client.query('DELETE FROM maquina_certificacion WHERE maquina_id = $1', [id]);
      for (const certId of certificaciones) {
        await client.query(
          `INSERT INTO maquina_certificacion (maquina_id, certificacion_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, certId]
        );
      }
    }
    await client.query('COMMIT');
    res.json(upd.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una máquina con ese nombre' });
    }
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /api/maquinas/:id/estado  -> cambiar solo el estado (con fechas automáticas)
// Body: { estado }
router.patch('/:id/estado', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!ESTADOS.includes(estado)) {
      return res.status(400).json({ error: `estado inválido (usa: ${ESTADOS.join(', ')})` });
    }

    // Ajustamos las fechas automáticamente según el nuevo estado.
    let sql;
    if (estado === 'En Progreso') {
      sql = `UPDATE maquinas
             SET estado = $2, fecha_inicio = COALESCE(fecha_inicio, NOW())
             WHERE id = $1 RETURNING *`;
    } else if (estado === 'Completada') {
      sql = `UPDATE maquinas
             SET estado = $2, fecha_inicio = COALESCE(fecha_inicio, NOW()), fecha_completada = NOW()
             WHERE id = $1 RETURNING *`;
    } else { // Pendiente: reiniciamos las fechas
      sql = `UPDATE maquinas
             SET estado = $2, fecha_inicio = NULL, fecha_completada = NULL
             WHERE id = $1 RETURNING *`;
    }

    const { rows } = await query(sql, [id, estado]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Máquina no encontrada' });
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/maquinas/:id  -> borrar (los vínculos y vulnerabilidades caen en cascada)
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rowCount } = await query('DELETE FROM maquinas WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Máquina no encontrada' });
    }
    res.status(204).end();
  } catch (err) { next(err); }
});

// ============================================================
//  VULNERABILIDADES anidadas bajo una máquina
// ============================================================

// GET /api/maquinas/:maquina_id/vulnerabilidades
router.get('/:maquina_id/vulnerabilidades', async (req, res, next) => {
  try {
    const { maquina_id } = req.params;
    const { rows } = await query(
      'SELECT * FROM vulnerabilidades WHERE maquina_id = $1 ORDER BY id', [maquina_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/maquinas/:maquina_id/vulnerabilidades  -> crear vulnerabilidad
// Body: { titulo*, cve?, tipo?, criticidad?, cvss?, descripcion?, anotaciones? }
router.post('/:maquina_id/vulnerabilidades', async (req, res, next) => {
  try {
    const { maquina_id } = req.params;
    const { cve, titulo, tipo, criticidad, cvss, descripcion, anotaciones } = req.body;

    if (!titulo) {
      return res.status(400).json({ error: 'El título es obligatorio' });
    }
    if (criticidad && !CRITICIDADES.includes(criticidad)) {
      return res.status(400).json({ error: `criticidad inválida (usa: ${CRITICIDADES.join(', ')})` });
    }
    if (cvss != null && (isNaN(cvss) || cvss < 0 || cvss > 10)) {
      return res.status(400).json({ error: 'cvss debe ser un número entre 0 y 10' });
    }

    // Comprobamos que la máquina exista (mensaje más claro que un error de FK)
    const m = await query('SELECT 1 FROM maquinas WHERE id = $1', [maquina_id]);
    if (m.rows.length === 0) {
      return res.status(404).json({ error: 'Máquina no encontrada' });
    }

    const { rows } = await query(`
      INSERT INTO vulnerabilidades (maquina_id, cve, titulo, tipo, criticidad, cvss, descripcion, anotaciones)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [maquina_id, cve || null, titulo, tipo || null, criticidad || null,
        cvss ?? null, descripcion || null, anotaciones || null]);

    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
