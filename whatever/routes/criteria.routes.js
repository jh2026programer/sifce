const router = require('express').Router();
const ctrl = require('../controllers/criteria.controller.js');
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.use(authenticate, authorize('company_admin'));

router.get('/', ctrl.listCriteria);
router.post('/', ctrl.createCriterion);
router.patch('/:id', ctrl.updateCriterion);
router.delete('/:id', ctrl.deleteCriterion);

module.exports = router;
