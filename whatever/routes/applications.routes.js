const router = require('express').Router();
const ctrl = require('../controllers/applications.controller.js');
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { requireActiveCompany } = require('../middleware/companyContext');

router.use(authenticate);

// RF08 / RF17 - candidato (siempre dentro de su entorno de empresa activo)
router.post('/', authorize('candidate'), requireActiveCompany, ctrl.applyToVacancy);
router.get('/mine', authorize('candidate'), requireActiveCompany, ctrl.listMyApplications);

// RF10 / RF12 - reclutador / administrador de empresa
router.get('/vacancy/:vacancyId', authorize('company_admin', 'recruiter'), ctrl.listApplicationsForVacancy);
router.get('/vacancy/:vacancyId/ranking', authorize('company_admin', 'recruiter'), ctrl.getRankingForVacancy);
router.post('/compare', authorize('company_admin', 'recruiter'), ctrl.compareApplications);

// RF09 / RF11 / RF13 - detalle, explicación y cambio de etapa
router.get('/:id', ctrl.getApplicationDetail); // visibilidad resuelta en el controlador
router.patch('/:id/stage', authorize('company_admin', 'recruiter'), ctrl.updateApplicationStage);
router.post('/:id/retry-analysis', authorize('company_admin', 'recruiter'), ctrl.retryAnalysis);
router.patch('/:id/withdraw', authorize('candidate'), ctrl.withdrawApplication);

module.exports = router;
