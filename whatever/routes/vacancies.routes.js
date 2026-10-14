const router = require('express').Router();
const ctrl = require('../controllers/vacancies.controller.js');
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { requireActiveCompany, attachActiveCompanyIfPresent } = require('../middleware/companyContext');

router.use(authenticate);

// RF16 - candidatos consultan vacantes de SU entorno de empresa vinculado (no público)
router.get('/browse', authorize('candidate'), requireActiveCompany, ctrl.browseActiveVacancies);

// RF05 - gestión interna de la empresa
router.get('/', authorize('company_admin', 'recruiter'), ctrl.listMyCompanyVacancies);
router.post('/', authorize('company_admin', 'recruiter'), ctrl.createVacancy);
router.get('/:id', attachActiveCompanyIfPresent, ctrl.getVacancy); // visibilidad se resuelve dentro del controlador según el rol
router.patch('/:id', authorize('company_admin', 'recruiter'), ctrl.updateVacancy);
router.patch('/:id/status', authorize('company_admin', 'recruiter'), ctrl.setVacancyStatus);

module.exports = router;
