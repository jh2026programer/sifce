const router = require('express').Router();
const ctrl = require('../controllers/candidates.controller.js');
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.use(authenticate);

// RF06 - perfil propio del candidato
router.get('/me', authorize('candidate'), ctrl.getMyProfile);
router.patch('/me', authorize('candidate'), ctrl.updateMyProfile);

// Vinculación privada por código (entornos por empresa)
router.get('/me/companies', authorize('candidate'), ctrl.listMyLinkedCompanies);
router.post('/me/companies', authorize('candidate'), ctrl.linkCompany);

router.post('/me/education', authorize('candidate'), ctrl.educationHandlers.add);
router.delete('/me/education/:itemId', authorize('candidate'), ctrl.educationHandlers.remove);

router.post('/me/experience', authorize('candidate'), ctrl.experienceHandlers.add);
router.delete('/me/experience/:itemId', authorize('candidate'), ctrl.experienceHandlers.remove);

router.post('/me/skills', authorize('candidate'), ctrl.skillHandlers.add);
router.delete('/me/skills/:itemId', authorize('candidate'), ctrl.skillHandlers.remove);

router.post('/me/languages', authorize('candidate'), ctrl.languageHandlers.add);
router.delete('/me/languages/:itemId', authorize('candidate'), ctrl.languageHandlers.remove);

router.post('/me/certifications', authorize('candidate'), ctrl.certificationHandlers.add);
router.delete('/me/certifications/:itemId', authorize('candidate'), ctrl.certificationHandlers.remove);

// Vista de la empresa sobre un candidato postulado (Sección 8)
router.get('/:id', authorize('company_admin', 'recruiter'), ctrl.getCandidateForCompany);

module.exports = router;
