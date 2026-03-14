import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const loginSchema = z.object({
    phone: z.string().min(10).max(20),
    password: z.string().min(6)
});

export const registerSchema = z.object({
    name: z.string().min(2).max(100),
    phone: z.string().min(10).max(20),
    password: z.string().min(6).max(100),
    role: z.enum(['rider', 'driver'])
});

export const rideSchema = z.object({
    riderId: z.string(),
    pickup: z.string().min(1),
    destination: z.string().min(1),
    pickupLoc: z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180)
    }),
    destLoc: z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180)
    }),
    serviceType: z.string(),
    proposedFare: z.number().optional(),
    scheduledTime: z.string().optional(),
    notes: z.string().optional()
});

export const validate = (schema: z.ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.issues
                });
            }
            next(error);
        }
    };
};
