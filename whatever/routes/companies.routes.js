const router = require('express').Router();
const ctrl = require('../controllers/companies.controller.js');
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.use(authenticate);

// RF19 - la propia empresa (debe ir antes de "/:id" para no chocar con la ruta genérica)
router.get('/mine', authorize('company_admin', 'recruiter'), ctrl.getMyCompany);
router.patch('/mine', authorize('company_admin'), ctrl.updateMyCompany);
router.patch('/mine/access-code', authorize('company_admin'), ctrl.regenerateAccessCode);

// RF04 - gestión global (superadministrador)
router.get('/', authorize('superadmin'), ctrl.listCompanies);
router.post('/', authorize('superadmin'), ctrl.createCompany);
router.get('/:id', authorize('superadmin'), ctrl.getCompanyById);
router.patch('/:id', authorize('superadmin'), ctrl.updateCompanyById);
router.patch('/:id/status', authorize('superadmin'), ctrl.setCompanyStatus);

module.exports = router;
