// ------------------------------------------------------------
//  Ruta: /api/dashboard
//  Devuelve en UNA sola llamada todo lo que pinta el dashboard,
//  reutilizando las funciones de estadísticas.
// ------------------------------------------------------------
const express = require('express');
const router = express.Router();
const { helpers } = require('./stats');

router.get('/', async (req, res, next) => {
  try {
    // Lanzamos todas las consultas en paralelo (más rápido que en serie).
    const [general, porCertificacion, porDificultad, vulnerabilidades, timeline] =
      await Promise.all([
        helpers.getGeneral(),
        helpers.getPorCertificacion(),
        helpers.getPorDificultad(),
        helpers.getVulnerabilidades(),
        helpers.getTimeline(),
      ]);

    res.json({
      general,
      por_certificacion: porCertificacion,
      por_dificultad: porDificultad,
      vulnerabilidades,
      timeline,
    });
  } catch (err) { next(err); }
});

module.exports = router;
