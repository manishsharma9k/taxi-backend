import express from 'express';
import { signup, login, getMe, sendOtp, loginInit, adminLogin, adminRegister, forgotPasswordUser, resetPasswordUser } from '../controllers/authController.js';
import { protect, adminProtect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/otp/send', sendOtp);
router.post('/login/init', loginInit);
router.post('/admin-register', adminProtect, adminRegister);
router.post('/admin-login', adminLogin);
router.post('/forgot-password', forgotPasswordUser);
router.post('/reset-password', resetPasswordUser);
router.get('/me', protect, getMe);

export default router;
