import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { searchAfghanistanPlaces, getCitiesByProvince, getPOIsNearby } from '../data/afghanistan';

export class PlacesController {

    /**
     * Search across all provinces, cities, hospitals, airports, hotels, etc.
     * Query string: ?q=kabul
     */
    async search(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const query = String(req.query.q || '');
            const limit = Number(req.query.limit) || 15;

            const results = searchAfghanistanPlaces(query, limit);
            res.json({ success: true, data: results });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all POIs near a given lat/lng
     * Query string: ?lat=34.5260&lng=69.1777&radius=10
     */
    async nearby(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const lat = Number(req.query.lat);
            const lng = Number(req.query.lng);
            const radiusKm = Number(req.query.radius) || 5;

            if (isNaN(lat) || isNaN(lng)) {
                return res.status(400).json({ success: false, message: 'Invalid coordinates' });
            }

            const pois = getPOIsNearby(lat, lng, radiusKm);
            res.json({ success: true, data: pois });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get cities by province id
     */
    async getCities(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { provinceId } = req.params;
            const cities = getCitiesByProvince(provinceId);
            res.json({ success: true, data: cities });
        } catch (error) {
            next(error);
        }
    }
}
