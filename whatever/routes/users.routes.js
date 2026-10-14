const router = require('express').Router();
const ctrl = require('../controllers/users.controller.js');
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.use(authenticate);

router.patch('/me', ctrl.updateMyAccount); // RF03 - cualquier usuario autenticado

// Gestión global de usuarios de la plataforma (Superadministrador).
// Van antes de "/:id" para no chocar con la ruta genérica.
router.get('/all', authorize('superadmin'), ctrl.listAllUsers);
router.patch('/all/:id', authorize('superadmin'), ctrl.updatePlatformUser);
router.patch('/all/:id/password', authorize('superadmin'), ctrl.resetPlatformUserPassword);
router.patch('/all/:id/unlock', authorize('superadmin'), ctrl.unlockPlatformUser);

router.get('/', authorize('company_admin'), ctrl.listCompanyUsers); // RF18
router.post('/', authorize('company_admin'), ctrl.createCompanyUser); // RF18
router.patch('/:id', authorize('company_admin'), ctrl.updateCompanyUser); // RF18

module.exports = router;
