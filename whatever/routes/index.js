const router = require('express').Router();

router.use('/auth', require('./auth.routes.js'));
router.use('/users', require('./users.routes.js'));
router.use('/companies', require('./companies.routes.js'));
router.use('/vacancies', require('./vacancies.routes.js'));
router.use('/candidates', require('./candidates.routes.js'));
router.use('/resumes', require('./resumes.routes.js'));
router.use('/applications', require('./applications.routes.js'));
router.use('/criteria', require('./criteria.routes.js'));
router.use('/stages', require('./stages.routes.js'));
router.use('/reports', require('./reports.routes.js'));

router.get('/health', (req, res) => res.json({ success: true, message: 'SIFCE API operativa.' }));

module.exports = router;
