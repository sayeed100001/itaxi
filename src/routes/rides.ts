import express from 'express';
import { RidesController } from '../controllers/ridesController.js';

const router = express.Router();

router.post('/request', RidesController.requestRide);
router.post('/:id/bid', RidesController.placeBid);
router.post('/:id/accept', RidesController.acceptRide);
router.patch('/:id/status', RidesController.updateStatus);

export default router;
