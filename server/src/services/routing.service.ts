import axios from 'axios';
import { createClient } from 'redis';
import { CircuitBreaker } from './circuit.service';
import logger from '../config/logger';
import prisma from '../config/database';
import { apiConfigService } from './apiConfig.service';

const ORS_BASE_URL = 'https://api.openrouteservice.org';
let API_KEY = process.env.OPENROUTESERVICE_API_KEY;
const ORS_TIMEOUT_MS = parseInt(process.env.ORS_TIMEOUT_MS || '5000');
const CACHE_TTL = 30;

interface Coordinates {
  lat: number;
  lng: number;
}

let redisClient: any = null;
const memoryCache = new Map<string, { data: any; expires: number }>();
const MAX_CACHE_SIZE = 1000;

const orsCircuit = new CircuitBreaker('OpenRouteService', {
  failureThreshold: 5,
  resetTimeout: 60000,
});

let metrics = {
  success: 0,
  failure: 0,
  cacheHits: 0,
  cacheMisses: 0,
};

if (process.env.REDIS_URL) {
  redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.connect().catch((err: any) => {
    logger.error('Redis connection failed for routing cache', { error: err });
    redisClient = null;
  });
}

function getCacheKey(endpoint: string, params: any): string {
  return `ors:${endpoint}:${JSON.stringify(params)}`;
}

async function getFromCache(key: string): Promise<any | null> {
  if (redisClient) {
    try {
      const cached = await redisClient.get(key);
      if (cached) {
        metrics.cacheHits++;
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.error('Redis get error', { error });
    }
  }

  const cached = memoryCache.get(key);
  if (cached && cached.expires > Date.now()) {
    metrics.cacheHits++;
    return cached.data;
  }

  metrics.cacheMisses++;
  return null;
}

async function setCache(key: string, data: any): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.setEx(key, CACHE_TTL, JSON.stringify(data));
      return;
    } catch (error) {
      logger.error('Redis set error', { error });
    }
  }

  if (memoryCache.size >= MAX_CACHE_SIZE) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) {
      memoryCache.delete(firstKey);
    }
  }

  memoryCache.set(key, {
    data,
    expires: Date.now() + CACHE_TTL * 1000,
  });
}

async function createAdminAlert(message: string, details: any) {
  try {
    await prisma.auditLog.create({
      data: {
        action: 'ORS_SERVICE_DOWN',
        details: JSON.stringify({ message, ...details }),
      },
    });
    logger.error('ADMIN ALERT: ' + message, details);
  } catch (error) {
    logger.error('Failed to create admin alert', { error });
  }
}

async function ensureOrsApiKeyLoaded() {
  if (API_KEY) return;
  const cfg = await apiConfigService.getOrsConfig();
  if (cfg?.apiKey) {
    API_KEY = cfg.apiKey;
  }
}

export const getDirections = async (start: Coordinates, end: Coordinates) => {
  await ensureOrsApiKeyLoaded();
  
  // If no API key, use fallback calculation
  if (!API_KEY) {
    logger.warn('No ORS API key configured, using fallback calculation');
    return calculateFallbackRoute(start, end);
  }
  
  const cacheKey = getCacheKey('directions', { start, end });
  const cached = await getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const result = await orsCircuit.execute(async () => {
      const response = await axios.post(
        `${ORS_BASE_URL}/v2/directions/driving-car`,
        {
          coordinates: [[start.lng, start.lat], [end.lng, end.lat]],
          instructions: false,
        },
        {
          headers: {
            Authorization: API_KEY as string,
            'Content-Type': 'application/json',
          },
          timeout: ORS_TIMEOUT_MS,
        }
      );

      const route = response.data.routes[0];
      return {
        geometry: route.geometry,
        distance: route.summary.distance,
        duration: route.summary.duration,
      };
    });

    metrics.success++;
    await setCache(cacheKey, result);
    return result;
  } catch (error: any) {
    metrics.failure++;
    
    logger.warn('ORS API failed, using fallback calculation', { error: error.message });
    return calculateFallbackRoute(start, end);
  }
};

function calculateFallbackRoute(start: Coordinates, end: Coordinates) {
  // Simple straight-line calculation
  const R = 6371e3; // Earth radius in meters
  const lat1 = start.lat * Math.PI / 180;
  const lat2 = end.lat * Math.PI / 180;
  const dLat = (end.lat - start.lat) * Math.PI / 180;
  const dLng = (end.lng - start.lng) * Math.PI / 180;

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  // Estimate duration (assuming 40 km/h average speed)
  const duration = (distance / 1000) * 90; // seconds
  
  // Create simple straight line geometry (encoded polyline format)
  const geometry = encodePolyline([[start.lat, start.lng], [end.lat, end.lng]]);
  
  return {
    geometry,
    distance: Math.round(distance),
    duration: Math.round(duration),
  };
}

function encodePolyline(coords: number[][]): string {
  let result = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const [lat, lng] of coords) {
    const iLat = Math.round(lat * 1e5);
    const iLng = Math.round(lng * 1e5);
    
    result += encodeValue(iLat - prevLat);
    result += encodeValue(iLng - prevLng);
    
    prevLat = iLat;
    prevLng = iLng;
  }
  
  return result;
}

function encodeValue(value: number): string {
  let encoded = '';
  let num = value < 0 ? ~(value << 1) : (value << 1);
  
  while (num >= 0x20) {
    encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }
  
  encoded += String.fromCharCode(num + 63);
  return encoded;
}

export const getMatrix = async (locations: Coordinates[]) => {
  await ensureOrsApiKeyLoaded();
  
  // If no API key, use fallback calculation
  if (!API_KEY) {
    logger.warn('No ORS API key configured, using fallback matrix calculation');
    return calculateFallbackMatrix(locations);
  }
  
  const cacheKey = getCacheKey('matrix', { locations });
  const cached = await getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const result = await orsCircuit.execute(async () => {
      const coordinates = locations.map((loc) => [loc.lng, loc.lat]);

      const response = await axios.post(
        `${ORS_BASE_URL}/v2/matrix/driving-car`,
        { locations: coordinates },
        {
          headers: {
            Authorization: API_KEY as string,
            'Content-Type': 'application/json',
          },
          timeout: ORS_TIMEOUT_MS,
        }
      );

      return {
        distances: response.data.distances,
        durations: response.data.durations,
      };
    });

    metrics.success++;
    await setCache(cacheKey, result);
    return result;
  } catch (error: any) {
    metrics.failure++;
    logger.warn('ORS matrix failed, using fallback calculation', { error: error.message });
    return calculateFallbackMatrix(locations);
  }
};

function calculateFallbackMatrix(locations: Coordinates[]) {
  const n = locations.length;
  const distances: number[][] = [];
  const durations: number[][] = [];
  
  for (let i = 0; i < n; i++) {
    distances[i] = [];
    durations[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        distances[i][j] = 0;
        durations[i][j] = 0;
      } else {
        const dist = calculateDistance(locations[i], locations[j]);
        distances[i][j] = dist;
        durations[i][j] = (dist / 1000) * 90; // 40 km/h average
      }
    }
  }
  
  return { distances, durations };
}

function calculateDistance(start: Coordinates, end: Coordinates): number {
  const R = 6371e3;
  const lat1 = start.lat * Math.PI / 180;
  const lat2 = end.lat * Math.PI / 180;
  const dLat = (end.lat - start.lat) * Math.PI / 180;
  const dLng = (end.lng - start.lng) * Math.PI / 180;

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
}

export const getMetrics = () => metrics;

export const getCircuitState = () => orsCircuit.getState();
