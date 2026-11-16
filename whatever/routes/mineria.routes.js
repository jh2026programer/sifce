const router = require('express').Router();
const ctrl = require('../controllers/mineria.controller.js');
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Los resultados vienen de un dataset sintético, no de los datos de ninguna
// empresa, así que no rompen el aislamiento: los ven el superadministrador y
// los equipos de selección de todas las empresas.
router.use(authenticate, authorize('superadmin', 'company_admin', 'recruiter'));

router.get('/resumen', ctrl.getResumen);
router.post('/prediccion', ctrl.predecir);

module.exports = router;
