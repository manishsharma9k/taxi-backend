import express from 'express';
import { getEstimate, bookRide, acceptRide, updateRideStatus, getPendingRides, getRideById, cancelRide, getActiveRide, captainCancelRide, getUserRides } from '../controllers/rideController.js';
import { protect, captainProtect, protectAny } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/estimate', getEstimate);
router.post('/book', protect, bookRide);
router.post('/cancel', protect, cancelRide);
// Captain endpoints
router.get('/pending', captainProtect, getPendingRides);
router.get('/active', captainProtect, getActiveRide);
router.post('/accept', captainProtect, acceptRide);
router.post('/status', captainProtect, updateRideStatus);
router.post('/captain-cancel', captainProtect, captainCancelRide);

// User endpoints
router.get('/user-rides', protect, getUserRides);

// Get ride by id (must come after specific string routes like /pending)
router.get('/:id', protectAny, getRideById);

export default router;
