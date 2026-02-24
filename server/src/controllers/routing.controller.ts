import { Request, Response } from 'express';
import { z } from 'zod';
import * as routingService from '../services/routing.service';
import logger from '../config/logger';

const directionsSchema = z.object({
  start: z.object({ lat: z.number(), lng: z.number() }),
  end: z.object({ lat: z.number(), lng: z.number() }),
});

const matrixSchema = z.object({
  locations: z.array(z.object({ lat: z.number(), lng: z.number() })).min(2),
});

export const directions = async (req: Request, res: Response) => {
  try {
    const { start, end } = directionsSchema.parse(req.body);
    const result = await routingService.getDirections(start, end);
    res.json(result);
  } catch (error: any) {
    logger.error('Directions error', { error: error.message, body: req.body });
    
    if (error.message === 'Routing service unavailable') {
      return res.status(503).json({ error: 'Routing service unavailable' });
    }
    
    if (error.response?.status === 401) {
      return res.status(500).json({ error: 'Routing service authentication failed' });
    }
    if (error.response?.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    res.status(500).json({ error: 'Failed to get directions' });
  }
};

export const matrix = async (req: Request, res: Response) => {
  try {
    const { locations } = matrixSchema.parse(req.body);
    const result = await routingService.getMatrix(locations);
    res.json(result);
  } catch (error: any) {
    logger.error('Matrix error', { error: error.message, body: req.body });
    
    if (error.message === 'Routing service unavailable') {
      return res.status(503).json({ error: 'Routing service unavailable' });
    }
    
    if (error.response?.status === 401) {
      return res.status(500).json({ error: 'Routing service authentication failed' });
    }
    if (error.response?.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    res.status(500).json({ error: 'Failed to get matrix' });
  }
};
