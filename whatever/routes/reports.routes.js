const router = require('express').Router();
const ctrl = require('../controllers/reports.controller.js');
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.use(authenticate, authorize('company_admin', 'recruiter'));

router.get('/summary', ctrl.getSummary);
router.get('/export/applications', ctrl.exportApplications);

module.exports = router;
