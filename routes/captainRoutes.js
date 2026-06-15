import express from 'express';
import { getCaptains, getCaptainById, createCaptain, updateCaptain, deleteCaptain, sendCaptainOtp, loginCaptain, getMe, getCaptainStats, updateLocation, getCaptainRideHistory, getNearbyCaptains, forgotPasswordCaptain, resetPasswordCaptain } from '../controllers/captainController.js';
import { captainProtect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/otp/send', sendCaptainOtp);
router.post('/login', loginCaptain);
router.post('/forgot-password', forgotPasswordCaptain);
router.post('/reset-password', resetPasswordCaptain);
router.get('/me', captainProtect, getMe);
router.get('/stats', captainProtect, getCaptainStats);
router.get('/ride-history', captainProtect, getCaptainRideHistory);
router.patch('/location', captainProtect, updateLocation);
router.get('/nearby', getNearbyCaptains);
router.get('/', getCaptains);
router.get('/:id', getCaptainById);
router.post('/add', createCaptain);
router.put('/:id', updateCaptain);
router.delete('/:id', deleteCaptain);

export default router;
