const router = require('express').Router();
const ctrl = require('../controllers/resumes.controller.js');
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { resumeUpload, handleUploadErrors } = require('../middleware/upload');

router.use(authenticate);

router.get('/', authorize('candidate'), ctrl.listMyResumes);
router.post('/', authorize('candidate'), resumeUpload.single('resume'), handleUploadErrors, ctrl.uploadResume);
router.delete('/:id', authorize('candidate'), ctrl.deleteResume);
router.get('/:id/file', authorize('candidate', 'company_admin', 'recruiter'), ctrl.downloadResume);

module.exports = router;
