import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as routingController from '../controllers/routing.controller';
import { validate } from '../middlewares/validate';
import { directionsSchema, matrixSchema } from '../validators/schemas';

const router = Router();

const routingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: 'Too many routing requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/directions', routingLimiter, validate(directionsSchema), routingController.directions);
router.post('/matrix', routingLimiter, validate(matrixSchema), routingController.matrix);

export default router;
