import { Router } from 'express';
import { TripController } from '../controllers/trip.controller';
import { requireAuth, requireRider, requireDriver, requireAdmin, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createTripSchema, tripIdSchema } from '../validators/schemas';

const router = Router();
const tripController = new TripController();

router.use(requireAuth);

router.post('/', authorize('RIDER', 'ADMIN'), validate(createTripSchema), tripController.createTrip);
router.post('/scheduled', authorize('RIDER', 'ADMIN'), validate(createTripSchema), tripController.createScheduledTrip);
router.get('/scheduled', tripController.getScheduledTrips);
router.post('/phone-booking', requireAdmin, tripController.createPhoneBooking);
router.post('/:tripId/accept', requireDriver, validate(tripIdSchema), tripController.acceptTrip);
router.post('/:tripId/sos', validate(tripIdSchema), tripController.triggerSOS);
router.get('/:tripId/messages', validate(tripIdSchema), tripController.getTripMessages);
router.post('/:tripId/messages', validate(tripIdSchema), tripController.sendTripMessage);
router.get('/:tripId/ratings', validate(tripIdSchema), tripController.getTripRatings);
router.post('/:tripId/rate', validate(tripIdSchema), tripController.rateTrip);
router.post('/:tripId/payment-collected', requireDriver, validate(tripIdSchema), tripController.markPaymentCollected);
router.post('/:tripId/settle', validate(tripIdSchema), tripController.settleTrip);
// SECURITY FIX: only DRIVER, RIDER (own trip), or ADMIN can update status.
// updateTripStatusSecure() enforces ownership + valid state machine transitions.
router.patch('/:tripId/status', authorize('DRIVER', 'RIDER', 'ADMIN'), validate(tripIdSchema), tripController.updateStatus);
router.get('/:tripId', validate(tripIdSchema), tripController.getTrip);
router.get('/', tripController.getUserTrips);

export default router;
