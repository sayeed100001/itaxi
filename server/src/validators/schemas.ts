import { z } from 'zod';

// Auth Schemas
export const requestOTPSchema = z.object({
  body: z.object({
    phone: z.string().min(10).max(15),
    name: z.string().min(2).max(100).optional(),
    role: z.enum(['RIDER', 'DRIVER', 'ADMIN']).optional(),
  }),
});

export const verifyOTPSchema = z.object({
  body: z.object({
    phone: z.string().min(10).max(15),
    code: z.string().length(6),
    name: z.string().min(2).max(100).optional(),
    role: z.enum(['RIDER', 'DRIVER', 'ADMIN']).optional(),
  }),
});

// Trip Schemas
export const createTripSchema = z.object({
  body: z.object({
    pickupLat: z.number().min(-90).max(90),
    pickupLng: z.number().min(-180).max(180),
    dropLat: z.number().min(-90).max(90),
    dropLng: z.number().min(-180).max(180),
    fare: z.number().positive(),
    distance: z.number().positive(),
    duration: z.number().positive(),
    serviceType: z.string().optional(),
    paymentMethod: z.enum(['CASH', 'WALLET']).optional(),
    scheduledFor: z
      .string()
      .min(16)
      .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: 'Invalid datetime' })
      .optional(),
    womenOnly: z.boolean().optional(),
    serviceClass: z.string().min(2).max(50).optional(),
    specialInstructions: z.string().max(191).optional(),
    bookingChannel: z.enum(['APP', 'PHONE']).optional(),
    requestedFor: z.object({
      name: z.string().min(2).max(100),
      phone: z.string().min(10).max(20),
    }).optional(),
    preferredDriverId: z.string().uuid().optional(),
    stops: z.array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        label: z.string().max(100).optional(),
      })
    ).max(5).optional(),
  }),
});

export const tripIdSchema = z.object({
  params: z.object({
    tripId: z.string().uuid(),
  }),
});

// Driver Schemas
export const createDriverSchema = z.object({
  body: z.object({
    vehicleType: z.string().min(2).max(50),
    plateNumber: z.string().min(2).max(20),
    baseFare: z.number().positive().optional(),
    perKmRate: z.number().positive().optional(),
  }),
});

export const updateLocationSchema = z.object({
  body: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    bearing: z.number().min(0).max(360).optional(),
  }),
});

// Payment Schemas
export const createSessionSchema = z.object({
  body: z.object({
    amount: z.number().positive().max(1000000),
  }),
});

export const payoutSchema = z.object({
  body: z.object({
    amount: z.number().positive().max(1000000),
  }),
});

// Routing Schemas
export const directionsSchema = z.object({
  body: z.object({
    start: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    end: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
  }),
});

export const matrixSchema = z.object({
  body: z.object({
    locations: z.array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
    ).min(2).max(25),
  }),
});
