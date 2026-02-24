import { Router } from 'express';
import { PlacesController } from '../controllers/places.controller';
import { requireAuth } from '../middlewares/auth';

const router = Router();
const placesController = new PlacesController();

// Riders and Drivers need to search locations.
router.use(requireAuth);

router.get('/search', placesController.search);
router.get('/nearby', placesController.nearby);
router.get('/province/:provinceId/cities', placesController.getCities);

export default router;
