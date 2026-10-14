const router = require('express').Router();
const ctrl = require('../controllers/stages.controller.js');
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.use(authenticate, authorize('company_admin'));

router.get('/', ctrl.listStages);
router.post('/', ctrl.createStage);
router.patch('/:id', ctrl.updateStage);

module.exports = router;
