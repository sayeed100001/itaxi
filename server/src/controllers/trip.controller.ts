import { Response, NextFunction } from 'express';
import { TripService } from '../services/trip.service';
import { AuthRequest } from '../middlewares/auth';
import { z } from 'zod';
import { getIo } from '../config/socket';

const tripService = new TripService();

const createTripSchema = z.object({
  pickupLat: z.number(),
  pickupLng: z.number(),
  dropLat: z.number(),
  dropLng: z.number(),
  fare: z.number(),
  distance: z.number(),
  duration: z.number(),
  serviceType: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'WALLET']).optional(),
  scheduledFor: z
    .string()
    .min(16)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: 'Invalid datetime' })
    .optional(),
  womenOnly: z.boolean().optional(),
  serviceClass: z.string().optional(),
  specialInstructions: z.string().optional(),
  bookingChannel: z.enum(['APP', 'PHONE']).optional(),
  requestedFor: z.object({
    name: z.string(),
    phone: z.string(),
  }).optional(),
  preferredDriverId: z.string().uuid().optional(),
  stops: z.array(
    z.object({
      lat: z.number(),
      lng: z.number(),
      label: z.string().optional(),
    })
  ).optional(),
});

const createScheduledTripSchema = createTripSchema.extend({
  scheduledFor: z
    .string()
    .min(16)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: 'Invalid datetime' }),
});

const phoneBookingSchema = createTripSchema.extend({
  riderPhone: z.string().min(10),
  riderName: z.string().min(2),
});

const sendMessageSchema = z.object({
  text: z.string().min(1).max(1000),
  channel: z.enum(['IN_APP', 'WHATSAPP']).default('IN_APP'),
});

const rateTripSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export class TripController {
  async createTrip(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createTripSchema.parse(req.body);
      const io = getIo();
      const trip = await tripService.createTrip({ ...data, riderId: req.user!.id }, io);
      res.status(201).json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }

  async acceptTrip(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId || '');
      const trip = await tripService.acceptTrip(tripId, req.user!.id);
      res.json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId || '');
      const { status } = req.body;
      const trip = await tripService.updateTripStatusSecure(tripId, status, req.user!);
      res.json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }

  async getTrip(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId || '');
      const trip = await tripService.getTripByIdWithOwnership(tripId, req.user!);
      res.json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }

  async getUserTrips(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const trips = await tripService.getUserTrips(req.user!.id, req.user!.role);
      res.json({ success: true, data: trips });
    } catch (error) {
      next(error);
    }
  }

  async triggerSOS(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId || '');
      const io = getIo();
      const result = await tripService.triggerSOS(tripId, req.user!.id, req.ip, req.get('user-agent'), io);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async markPaymentCollected(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId || '');
      const { paymentMethod } = req.body;
      const trip = await tripService.markPaymentCollected(tripId, paymentMethod || 'CASH');
      res.json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }

  async settleTrip(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId || '');
      const trip = await tripService.settleTrip(tripId, req.user!);
      res.json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }

  async createScheduledTrip(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = createScheduledTripSchema.parse(req.body);
      const io = getIo();
      const trip = await tripService.createTrip(
        {
          ...data,
          riderId: req.user!.id,
          bookingChannel: 'APP',
        },
        io
      );
      res.status(201).json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }

  async getScheduledTrips(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const trips = await tripService.getScheduledTrips(req.user!.id, req.user!.role);
      res.json({ success: true, data: trips });
    } catch (error) {
      next(error);
    }
  }

  async createPhoneBooking(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = phoneBookingSchema.parse(req.body);
      const io = getIo();
      const trip = await tripService.createPhoneBooking(data, io);
      res.status(201).json({ success: true, data: trip });
    } catch (error) {
      next(error);
    }
  }

  async getTripMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId || '');
      const messages = await tripService.getTripMessages(tripId, req.user!);
      res.json({ success: true, data: messages });
    } catch (error) {
      next(error);
    }
  }

  async sendTripMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId || '');
      const payload = sendMessageSchema.parse(req.body);
      const io = getIo();
      const message = await tripService.sendTripMessage(tripId, req.user!, payload, io);
      res.status(201).json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  }

  async rateTrip(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId || '');
      const payload = rateTripSchema.parse(req.body);
      const rating = await tripService.rateTrip(tripId, req.user!, payload);
      res.status(201).json({ success: true, data: rating });
    } catch (error) {
      next(error);
    }
  }

  async getTripRatings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tripId = String(req.params.tripId || '');
      const ratings = await tripService.getTripRatings(tripId, req.user!);
      res.json({ success: true, data: ratings });
    } catch (error) {
      next(error);
    }
  }
}
