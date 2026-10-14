const router = require('express').Router();
const ctrl = require('../controllers/auth.controller.js');
const { authenticate } = require('../middleware/auth');

router.get('/public-config', ctrl.publicConfig);

router.post('/login', ctrl.login);
router.post('/login/verify-otp', ctrl.verifyLoginOtp);
router.post('/login/resend-otp', ctrl.resendLoginOtp);

router.post('/register/candidate', ctrl.registerCandidate);
router.post('/register/company', ctrl.registerCompany);
router.get('/me', authenticate, ctrl.me);

module.exports = router;
