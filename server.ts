import { z } from "zod";
import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import os from "os";
import fs from "fs";
import multer from "multer";
import { db, query } from "./db-config.js";
import { metricsService } from "./services/metrics.js";
import { log } from "./services/logger.js";
import { TwoFactorService } from "./services/twoFactor.js";
import { EmergencyService } from "./services/emergency.js";
import { PromoCodeService } from "./services/promoCode.js";
import { ReferralService } from "./services/referral.js";
import { DynamicPricingService } from "./services/dynamicPricing.js";
import { FraudDetectionService } from "./services/fraudDetection.js";
import { PaymentService } from "./services/payment.js";
import { cache } from "./services/cache.js";
import { LoginOtpService } from "./services/loginOtp.js";

import { BackgroundCheckService } from "./services/backgroundCheck.js";
import { InstantPayoutService } from "./services/instantPayout.js";
import { ABTestingService } from "./services/abTesting.js";
import { PackageDeliveryService } from "./services/packageDelivery.js";
import { TripRecordingService } from "./services/tripRecording.js";
import { EncryptionService } from "./services/encryption.js";
import { HeatMapService } from "./services/heatMap.js";
import { RideSharingService } from "./services/rideSharing.js";
import { MultiStopService } from "./services/multiStop.js";
import { requireRole, requireOwnership } from "./middleware/authorization.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Enterprise Imports
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { latLngToCell, gridDisk } from 'h3-js';
import Stripe from 'stripe';
import twilio from 'twilio';
import * as admin from 'firebase-admin';

dotenv.config();

const NODE_ENV = (process.env.NODE_ENV || 'development').trim();

// Enterprise Infrastructure Setup
let redisClient: any = null;
let redisSubClient: any = null;
if (process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisSubClient = redisClient.duplicate();
    Promise.all([redisClient.connect(), redisSubClient.connect()]).then(() => {
        console.log("Redis connected and Socket.IO adapter configured.");
    }).catch(e => console.error("Redis connection failed:", e));
}

let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-01-27.acacia' as any });
}

let twilioClient: twilio.Twilio | null = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
        const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin initialized.");
    } catch (e) {
        console.error("Firebase Admin initialization failed:", e);
    }
}

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

if (redisClient && redisSubClient) {
    io.adapter(createAdapter(redisClient, redisSubClient));
}

const PORT = Number.parseInt(process.env.PORT || '5000', 10) || 5000;

// Prevent hard crashes when the port is already occupied.
httpServer.on("error", (err: any) => {
    if (err?.code === "EADDRINUSE") {
        const msg =
            `Port ${PORT} is already in use. ` +
            `Stop the other process, or use dev helpers: dev-start.bat (Windows) / dev-start.sh (macOS/Linux).`;
        log.error(msg, err);
        // Exit so orchestrators (Railway) can restart/mark deploy failed cleanly.
        process.exit(1);
    }
    log.error("HTTP server error", err);
});

// Initialize cache
cache.connect().catch(e => log.error('Cache connection failed', e));

// Security Middleware
app.use(metricsService.middleware());
if (NODE_ENV === "production") {
    app.use(helmet({
        contentSecurityPolicy: false, // Often needed for Vite apps unless configured perfectly
    }));
}
app.use(cors());
app.use(express.json());

// Serve uploaded assets (logo, taxi icons, KYC docs, etc.)
const uploadsDir = process.env.VERCEL === "1" ? "/tmp/uploads" : path.join(process.cwd(), "public", "uploads");
try {
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
} catch (e) {
    console.error("Failed to ensure uploads directory:", e);
}
app.use("/uploads", express.static(uploadsDir));

const limiter = rateLimit({
    windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '', 10) || 15 * 60 * 1000,
    max:
        Number.parseInt(process.env.RATE_LIMIT_MAX || '', 10) ||
        Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '', 10) ||
        3000,
    standardHeaders: true,
    legacyHeaders: false,
    // Skip health/metrics AND high-frequency realtime endpoints that must remain responsive
    skip: (req) =>
        req.path === '/api/health' ||
        req.path === '/api/ready' ||
        req.path === '/api/metrics' ||
        req.path.startsWith('/api/drivers') ||
        req.path.startsWith('/api/rides') ||
        req.path.startsWith('/api/auth')
});
app.use("/api/", limiter);

// JWT Authentication Middleware
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development_only';

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Access denied - No token provided" });
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            console.log('Token verification failed:', err.message);
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: "Token expired" });
            }
            // Invalid signature/malformed token should be treated as "unauthorized" so clients can logout/refresh.
            return res.status(401).json({ error: "Invalid token" });
        }
        (req as any).user = user;
        next();
    });
};

const getAuthUser = (req: Request): { id: string; role: string } | null => {
    return ((req as any).user || null) as { id: string; role: string } | null;
};

const isAdminUser = (req: Request): boolean => {
    const user = getAuthUser(req);
    return !!user && user.role === "admin";
};

const isSelfOrAdmin = (req: Request, userId: string): boolean => {
    const user = getAuthUser(req);
    if (!user) return false;
    return user.role === "admin" || user.id === userId;
};

const firstParam = (value: string | string[] | undefined): string => {
    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
};

// Helper function to generate UUID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

async function ensureDriverCreditAccount(driverId: string) {
    await query(
        "INSERT IGNORE INTO driver_credit_accounts (driver_id, balance) VALUES (?, 0)",
        [driverId]
    );
}

async function getDriverCreditBalance(driverId: string): Promise<number> {
    await ensureDriverCreditAccount(driverId);
    const res = await query("SELECT balance FROM driver_credit_accounts WHERE driver_id = ? LIMIT 1", [driverId]);
    const bal = res.rows[0]?.balance;
    return typeof bal === 'number' ? bal : Number.parseFloat(bal || '0') || 0;
}

async function creditDriverAccount(params: {
    driverId: string;
    amount: number;
    entryType: 'admin_credit' | 'adjustment' | 'refund';
    description?: string;
    createdBy?: string;
}) {
    const amountNum = Number(params.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) throw new Error("Invalid credit amount");
    await ensureDriverCreditAccount(params.driverId);

    await query(
        "UPDATE driver_credit_accounts SET balance = balance + ?, updated_at = NOW() WHERE driver_id = ?",
        [amountNum, params.driverId]
    );
    await query(
        "INSERT INTO driver_credit_ledger (id, driver_id, ride_id, amount, entry_type, description, created_by, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?, NOW())",
        [generateId(), params.driverId, amountNum, params.entryType, params.description || null, params.createdBy || null]
    );
}

async function debitDriverAccount(params: {
    driverId: string;
    amount: number;
    rideId?: string | null;
    entryType: 'ride_commission' | 'ride_fee' | 'adjustment';
    description?: string;
    createdBy?: string;
    enforceSufficient?: boolean;
}) {
    const amountNum = Number(params.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) throw new Error("Invalid debit amount");
    await ensureDriverCreditAccount(params.driverId);

    // Atomic decrement with optional sufficiency check.
    const updateSql = params.enforceSufficient
        ? "UPDATE driver_credit_accounts SET balance = balance - ?, updated_at = NOW() WHERE driver_id = ? AND balance >= ?"
        : "UPDATE driver_credit_accounts SET balance = balance - ?, updated_at = NOW() WHERE driver_id = ?";
    const updateParams = params.enforceSufficient
        ? [amountNum, params.driverId, amountNum]
        : [amountNum, params.driverId];
    const upd = await query(updateSql, updateParams);
    const affected = (upd.rows?.[0] as any)?.affectedRows ?? 0;
    if (params.enforceSufficient && affected === 0) {
        throw new Error("INSUFFICIENT_DRIVER_CREDIT");
    }

    await query(
        "INSERT INTO driver_credit_ledger (id, driver_id, ride_id, amount, entry_type, description, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
        [
            generateId(),
            params.driverId,
            params.rideId || null,
            -amountNum,
            params.entryType,
            params.description || null,
            params.createdBy || null
        ]
    );
}

async function recordSystemRevenue(params: { rideId?: string | null; driverId?: string | null; amount: number; revenueType: 'commission' | 'fee' | 'other' }) {
    const amountNum = Number(params.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) return;
    await query(
        "INSERT INTO system_revenue_ledger (id, ride_id, driver_id, amount, revenue_type, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
        [generateId(), params.rideId || null, params.driverId || null, amountNum, params.revenueType]
    );
}

log.info('iTaxi Server starting...');

if (process.env.VERCEL === '1') { import('./init-db-postgres.js').then(m => m.initDbIfNeeded()).catch(e => log.warn('DB init', { error: e?.message })); }

type LatLng = { lat: number; lng: number };
type RouteData = {
    coordinates: [number, number][];
    distance: number; // meters
    duration: number; // seconds
    bbox?: [number, number, number, number]; // [minLat, minLng, maxLat, maxLng]
};

type PoiCategory = 'hotel' | 'airport' | 'mall' | 'shopping' | 'restaurant' | 'hospital' | 'fuel' | 'landmark' | 'poi';
type Poi = {
    id: string;
    name: string;
    category: PoiCategory;
    location: LatLng;
    address?: string;
    source: 'osm';
};

const POI_MEM_CACHE_TTL_MS = Number.parseInt(process.env.POI_MEM_CACHE_TTL_MS || '', 10) || 5 * 60 * 1000;
const poiMemCache = new Map<string, { expiresAt: number; data: Poi[] }>();

function metersToBbox(center: LatLng, radiusM: number): { south: number; west: number; north: number; east: number } {
    // Rough conversion; good enough for POI discovery. Avoids heavy geometry libs on the server.
    const latDelta = radiusM / 111_320; // meters per degree latitude
    const lngDelta = radiusM / (111_320 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)));

    return {
        south: center.lat - latDelta,
        west: center.lng - lngDelta,
        north: center.lat + latDelta,
        east: center.lng + lngDelta,
    };
}

function normalizePoiCategories(input: unknown): PoiCategory[] {
    const allowed = new Set<PoiCategory>([
        'hotel',
        'airport',
        'mall',
        'shopping',
        'restaurant',
        'hospital',
        'fuel',
        'landmark',
        'poi',
    ]);

    const raw =
        typeof input === 'string'
            ? input
            : Array.isArray(input)
                ? input.join(',')
                : '';

    const parts = raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

    const cats = (parts.length ? parts : ['hotel', 'airport', 'mall'])
        .map((c) => (allowed.has(c as PoiCategory) ? (c as PoiCategory) : null))
        .filter((c): c is PoiCategory => Boolean(c));

    // Ensure stable ordering
    return Array.from(new Set(cats)).sort();
}

function poiCategoryFromTags(tags: any): PoiCategory {
    if (!tags || typeof tags !== 'object') return 'poi';

    const tourism = String(tags.tourism || '').toLowerCase();
    if (tourism === 'hotel' || tourism === 'hostel' || tourism === 'guest_house' || tourism === 'motel') return 'hotel';

    const aeroway = String(tags.aeroway || '').toLowerCase();
    if (aeroway === 'aerodrome' || aeroway === 'airport') return 'airport';

    const shop = String(tags.shop || '').toLowerCase();
    const amenity = String(tags.amenity || '').toLowerCase();
    if (shop === 'mall' || amenity === 'shopping_mall' || amenity === 'marketplace') return 'mall';

    if (amenity === 'restaurant' || amenity === 'cafe' || amenity === 'fast_food') return 'restaurant';
    if (amenity === 'hospital' || amenity === 'clinic' || amenity === 'doctors' || amenity === 'pharmacy') return 'hospital';
    if (amenity === 'fuel') return 'fuel';

    return 'poi';
}

function buildOverpassQuery(bbox: { south: number; west: number; north: number; east: number }, categories: PoiCategory[], limit: number) {
    const { south, west, north, east } = bbox;
    const bb = `${south},${west},${north},${east}`;

    const blocks: string[] = [];
    const want = new Set(categories);

    if (want.has('hotel')) {
        blocks.push(`node["tourism"="hotel"](${bb});`);
        blocks.push(`way["tourism"="hotel"](${bb});`);
        blocks.push(`relation["tourism"="hotel"](${bb});`);
        blocks.push(`node["tourism"="guest_house"](${bb});`);
        blocks.push(`node["tourism"="hostel"](${bb});`);
    }

    if (want.has('airport')) {
        blocks.push(`node["aeroway"="aerodrome"](${bb});`);
        blocks.push(`way["aeroway"="aerodrome"](${bb});`);
        blocks.push(`relation["aeroway"="aerodrome"](${bb});`);
        blocks.push(`node["aeroway"="terminal"](${bb});`);
        blocks.push(`way["aeroway"="terminal"](${bb});`);
    }

    if (want.has('mall') || want.has('shopping')) {
        blocks.push(`node["shop"="mall"](${bb});`);
        blocks.push(`way["shop"="mall"](${bb});`);
        blocks.push(`relation["shop"="mall"](${bb});`);
        blocks.push(`node["amenity"="shopping_mall"](${bb});`);
        blocks.push(`way["amenity"="shopping_mall"](${bb});`);
        blocks.push(`relation["amenity"="shopping_mall"](${bb});`);
        blocks.push(`node["amenity"="marketplace"](${bb});`);
    }

    if (want.has('restaurant')) {
        blocks.push(`node["amenity"~"^(restaurant|cafe|fast_food)$"](${bb});`);
    }

    if (want.has('hospital')) {
        blocks.push(`node["amenity"~"^(hospital|clinic|doctors|pharmacy)$"](${bb});`);
    }

    if (want.has('fuel')) {
        blocks.push(`node["amenity"="fuel"](${bb});`);
    }

    // Always allow a generic landmark fallback when caller passes "poi"
    if (want.has('landmark') || want.has('poi')) {
        blocks.push(`node["tourism"="attraction"](${bb});`);
        blocks.push(`node["historic"](${bb});`);
    }

    // NOTE: Overpass doesn't guarantee stable ordering; we slice server-side.
    return `
[out:json][timeout:18];
(
${blocks.join('\n')}
);
out center qt;
`.trim();
}

async function fetchOverpassPois(bbox: { south: number; west: number; north: number; east: number }, categories: PoiCategory[], limit: number): Promise<Poi[]> {
    const key = `overpass:${categories.join(',')}:${bbox.south.toFixed(3)},${bbox.west.toFixed(3)},${bbox.north.toFixed(3)},${bbox.east.toFixed(3)}:${limit}`;
    const now = Date.now();
    const cached = poiMemCache.get(key);
    if (cached && cached.expiresAt > now) return cached.data;

    const query = buildOverpassQuery(bbox, categories, limit);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
        const body = new URLSearchParams({ data: query }).toString();

        const endpoints = [
            "https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter",
            "https://overpass.openstreetmap.ru/api/interpreter",
        ];

        let json: any = null;
        let lastErr: any = null;

        for (const endpoint of endpoints) {
            try {
                const resp = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
                        "Accept": "application/json",
                        // Overpass maintainers strongly prefer a UA identifying your app.
                        "User-Agent": "iTaxi/1.0 (POI directory; https://itaxi.local)"
                    },
                    body,
                    signal: controller.signal,
                });

                if (!resp.ok) {
                    const text = await resp.text().catch(() => '');
                    lastErr = new Error(`OVERPASS_ERROR_${resp.status}:${text?.slice(0, 200) || ''}`);
                    continue;
                }

                json = await resp.json().catch(() => null);
                if (json) break;
            } catch (e: any) {
                lastErr = e;
            }
        }

        if (!json) {
            throw lastErr || new Error("OVERPASS_UNAVAILABLE");
        }

        const elements: any[] = Array.isArray(json?.elements) ? json.elements : [];

        const pois: Poi[] = [];
        for (const el of elements) {
            const tags = el?.tags || {};
            const nameRaw =
                typeof tags?.name === 'string' ? tags.name :
                    typeof tags?.['name:en'] === 'string' ? tags['name:en'] :
                        typeof tags?.['name:fa'] === 'string' ? tags['name:fa'] :
                            typeof tags?.official_name === 'string' ? tags.official_name : '';
            const name = String(nameRaw || '').trim();
            if (!name) continue;

            const lat = typeof el?.lat === 'number'
                ? el.lat
                : typeof el?.center?.lat === 'number'
                    ? el.center.lat
                    : null;
            const lng = typeof el?.lon === 'number'
                ? el.lon
                : typeof el?.center?.lon === 'number'
                    ? el.center.lon
                    : null;

            if (lat === null || lng === null) continue;

            const category = poiCategoryFromTags(tags);

            // If caller didn't request this derived category, keep only if generic "poi" was requested.
            if (!categories.includes(category) && !categories.includes('poi')) continue;

            const id = `osm:${String(el?.type || 'node')}/${String(el?.id || name)}`;
            const addressParts: string[] = [];
            if (typeof tags?.['addr:street'] === 'string') addressParts.push(tags['addr:street']);
            if (typeof tags?.['addr:housenumber'] === 'string') addressParts.push(tags['addr:housenumber']);
            if (typeof tags?.['addr:city'] === 'string') addressParts.push(tags['addr:city']);
            const address = addressParts.length ? addressParts.join(' ') : (typeof tags?.['addr:full'] === 'string' ? tags['addr:full'] : undefined);

            pois.push({
                id,
                name,
                category,
                location: { lat, lng },
                address,
                source: 'osm',
            });

            if (pois.length >= limit) break;
        }

        poiMemCache.set(key, { expiresAt: now + POI_MEM_CACHE_TTL_MS, data: pois });
        return pois;
    } finally {
        clearTimeout(timeout);
    }
}

const ADMIN_SETTINGS_CACHE_TTL_MS =
    Number.parseInt(process.env.ADMIN_SETTINGS_CACHE_TTL_MS || '', 10) || 5000;
let adminSettingsCache: any | null = null;
let adminSettingsCacheAt = 0;

async function getAdminSettingsCached(): Promise<any | null> {
    const now = Date.now();
    if (adminSettingsCache && now - adminSettingsCacheAt < ADMIN_SETTINGS_CACHE_TTL_MS) {
        return adminSettingsCache;
    }

    try {
        const result = await query("SELECT settings FROM admin_settings WHERE id = 1");
        if (!result?.rows?.length) {
            adminSettingsCache = null;
            adminSettingsCacheAt = now;
            return null;
        }

        adminSettingsCache = JSON.parse(result.rows[0].settings);
        adminSettingsCacheAt = now;
        return adminSettingsCache;
    } catch (e) {
        adminSettingsCache = null;
        adminSettingsCacheAt = now;
        return null;
    }
}

function setAdminSettingsCached(settings: any | null) {
    adminSettingsCache = settings;
    adminSettingsCacheAt = Date.now();
}

function isFiniteNumber(v: any): v is number {
    return typeof v === 'number' && Number.isFinite(v);
}

function isValidLatLng(v: any): v is LatLng {
    return (
        v &&
        isFiniteNumber(v.lat) &&
        isFiniteNumber(v.lng) &&
        Math.abs(v.lat) <= 90 &&
        Math.abs(v.lng) <= 180
    );
}

function haversineMeters(a: LatLng, b: LatLng): number {
    const R = 6371000; // meters
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const x =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * c;
}

function buildMockRoute(start: LatLng, end: LatLng): RouteData {
    const distance = haversineMeters(start, end);
    // Assume 30km/h average in city: duration(seconds) = meters / (m/s)
    const avgSpeedMps = (30_000 / 3600);
    const duration = distance / avgSpeedMps;
    return {
        coordinates: [
            [start.lat, start.lng],
            [end.lat, end.lng]
        ],
        distance,
        duration,
        bbox: [
            Math.min(start.lat, end.lat),
            Math.min(start.lng, end.lng),
            Math.max(start.lat, end.lat),
            Math.max(start.lng, end.lng)
        ]
    };
}

async function routeWithOSRM(start: LatLng, end: LatLng): Promise<RouteData> {
    const baseUrl = "https://router.project-osrm.org/route/v1/driving";
    const url = `${baseUrl}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

    const response = await fetch(url);
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`OSRM_ERROR_${response.status}:${text?.slice(0, 200) || ''}`);
    }

    const data: any = await response.json();
    if (!data?.routes?.length) throw new Error("OSRM_NO_ROUTE");

    const route = data.routes[0];
    const coords = route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) throw new Error("OSRM_BAD_GEOMETRY");

    const latLngs: [number, number][] = coords.map((c: number[]) => [c[1], c[0]]);
    return {
        coordinates: latLngs,
        distance: Number(route.distance) || 0,
        duration: Number(route.duration) || 0,
        bbox: [
            Math.min(start.lat, end.lat),
            Math.min(start.lng, end.lng),
            Math.max(start.lat, end.lat),
            Math.max(start.lng, end.lng)
        ]
    };
}

async function routeWithORS(start: LatLng, end: LatLng, apiKey: string): Promise<RouteData> {
    const baseUrl = "https://api.openrouteservice.org/v2/directions/driving-car";
    const startCoord = `${start.lng},${start.lat}`;
    const endCoord = `${end.lng},${end.lat}`;
    const params = new URLSearchParams({ start: startCoord, end: endCoord });
    const url = `${baseUrl}?${params.toString()}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json, application/geo+json; charset=utf-8',
            // ORS supports passing the key via query param or Authorization header. Header avoids leaking keys into logs.
            'Authorization': apiKey
        }
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`ORS_ERROR_${response.status}:${text?.slice(0, 200) || ''}`);
    }

    const data: any = await response.json();
    const feature = data?.features?.[0];
    const coords = feature?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) throw new Error("ORS_NO_ROUTE");

    const latLngs: [number, number][] = coords.map((c: number[]) => [c[1], c[0]]);
    const summary = feature?.properties?.summary || {};
    const segment0 = feature?.properties?.segments?.[0] || {};

    const distance = Number(summary.distance ?? segment0.distance) || 0;
    const duration = Number(summary.duration ?? segment0.duration) || 0;

    const bbox =
        Array.isArray(data?.bbox) && data.bbox.length === 4
            ? ([data.bbox[1], data.bbox[0], data.bbox[3], data.bbox[2]] as [number, number, number, number])
            : undefined;

    return { coordinates: latLngs, distance, duration, bbox };
}

async function routeWithMapbox(start: LatLng, end: LatLng, accessToken: string): Promise<RouteData> {
    const baseUrl = "https://api.mapbox.com/directions/v5/mapbox/driving";
    const url = `${baseUrl}/${start.lng},${start.lat};${end.lng},${end.lat}?geometries=geojson&overview=full&access_token=${encodeURIComponent(accessToken)}`;

    const response = await fetch(url);
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`MAPBOX_ERROR_${response.status}:${text?.slice(0, 200) || ''}`);
    }

    const data: any = await response.json();
    if (!data?.routes?.length) throw new Error("MAPBOX_NO_ROUTE");
    const route = data.routes[0];
    const coords = route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) throw new Error("MAPBOX_BAD_GEOMETRY");

    const latLngs: [number, number][] = coords.map((c: number[]) => [c[1], c[0]]);
    return {
        coordinates: latLngs,
        distance: Number(route.distance) || 0,
        duration: Number(route.duration) || 0,
        bbox: [
            Math.min(start.lat, end.lat),
            Math.min(start.lng, end.lng),
            Math.max(start.lat, end.lat),
            Math.max(start.lng, end.lng)
        ]
    };
}

async function calculateRouteWithFallback(
    start: LatLng,
    end: LatLng,
    preferProvider?: string
): Promise<{ route: RouteData; provider: string }> {
    const settings = (await getAdminSettingsCached()) || {};
    const routingProvider = String(preferProvider || settings?.routingProvider || 'ors').toLowerCase();
    const apiKeys = settings?.apiKeys || {};

    const providers: Array<{ name: string; fn: () => Promise<RouteData> }> = [];
    const addProvider = (name: string, fn: () => Promise<RouteData>) => {
        if (!providers.some(p => p.name === name)) providers.push({ name, fn });
    };

    if (routingProvider === 'ors') {
        const key = String(apiKeys?.ors || '').trim();
        if (key) addProvider('ors', () => routeWithORS(start, end, key));
        else addProvider('ors', async () => { throw new Error('ORS_API_KEY_MISSING'); });
    } else if (routingProvider === 'mapbox') {
        const key = String(apiKeys?.mapbox || '').trim();
        if (key) addProvider('mapbox', () => routeWithMapbox(start, end, key));
        else addProvider('mapbox', async () => { throw new Error('MAPBOX_ACCESS_TOKEN_MISSING'); });
    } else if (routingProvider === 'mock') {
        addProvider('mock', async () => buildMockRoute(start, end));
    }

    // Always provide a safe fallback chain so ride flow doesn't break.
    addProvider('osrm', () => routeWithOSRM(start, end));
    addProvider('mock', async () => buildMockRoute(start, end));

    let lastError: any = null;
    for (const p of providers) {
        try {
            const route = await p.fn();
            return { route, provider: p.name };
        } catch (e: any) {
            lastError = e;
            log.warn('Routing provider failed', { provider: p.name, error: e?.message || String(e) });
        }
    }

    throw new Error(lastError?.message || 'Routing failed');
}

// --- API Routes ---

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/ready", async (_req, res) => {
    try {
        await query("SELECT 1 as ok");
        res.json({ status: "ready" });
    } catch (e: any) {
        res.status(503).json({ status: "not_ready", error: e?.message || "DB not ready" });
    }
});

app.get("/api/metrics", (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(metricsService.getMetrics());
});

// Routing proxy so frontend doesn't depend on direct OSRM calls (fixes CORS/Network issues)
app.post("/api/route", async (req, res) => {
    try {
        const { start, end, provider } = req.body || {};
        if (!isValidLatLng(start) || !isValidLatLng(end)) {
            return res.status(400).json({ error: "Invalid start/end coordinates" });
        }

        const prefer = typeof provider === 'string' && provider.trim() ? provider.trim() : undefined;
        const { route, provider: used } = await calculateRouteWithFallback(start, end, prefer);
        res.setHeader('X-Routing-Provider', used);
        return res.json(route);
    } catch (e: any) {
        log.error('Routing proxy error', { error: e?.message || String(e), stack: e?.stack });
        return res.status(502).json({ error: e?.message || "Routing error" });
    }
});

// POI directory (Hotels, Airports, Shopping centers, ...). Uses OSM Overpass with caching.
// Public endpoint: shown on the rider map (Uber-like).
const poiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
});

app.get("/api/pois", poiLimiter, async (req, res) => {
    const schema = z.object({
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180),
        radiusM: z.coerce.number().min(200).max(10_000).default(2500),
        limit: z.coerce.number().min(1).max(150).default(80),
        categories: z.any().optional(),
    });

    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
    }

    const { lat, lng, radiusM, limit } = parsed.data;
    const categories = normalizePoiCategories((req.query as any)?.categories);

    try {
        const bbox = metersToBbox({ lat, lng }, radiusM);
        const pois = await fetchOverpassPois(bbox, categories, limit);
        return res.json({ provider: "overpass", pois });
    } catch (e: any) {
        log.error('POI search failed', { error: e?.message || String(e) });
        return res.json({ provider: "overpass", pois: [] });
    }
});

app.get("/api/settings", async (req, res) => {
    try {
        // Optional auth: settings must be readable on landing page, but API keys must be hidden for non-admins.
        const authHeader = req.headers.authorization;
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token) {
                try {
                    const decoded: any = jwt.verify(token, JWT_SECRET);
                    if (decoded?.id && decoded?.role) {
                        (req as any).user = { id: decoded.id, role: decoded.role };
                    }
                } catch {
                    // Ignore invalid/expired token for this public endpoint.
                }
            }
        }

        const result = await query("SELECT settings FROM admin_settings WHERE id = 1");
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Settings not found" });
        }
        const settings = JSON.parse(result.rows[0].settings);
        if (!isAdminUser(req) && settings.apiKeys) {
            settings.apiKeys = { ors: '', mapbox: '', google: '' };
        }
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: "Settings error" });
    }
});

// Auth Routes
const loginSchema = z.object({
    phone: z.string(),
    password: z.string()
});

app.post("/api/auth/login", async (req, res) => {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: validation.error.issues });
    
    const { phone, password } = validation.data;
    const captchaToken = (req.body as any)?.captchaToken;
    try {
        // reCAPTCHA verification (if enabled in admin settings)
        try {
            const settings = (await getAdminSettingsCached()) || {};
            const recaptchaCfg = settings?.auth?.recaptcha;
            if (recaptchaCfg?.enabled && (recaptchaCfg?.applyTo || []).includes('login')) {
                const secret = String(process.env.RECAPTCHA_SECRET_KEY || '').trim();
                if (!secret) return res.status(500).json({ error: 'RECAPTCHA_NOT_CONFIGURED' });
                if (!captchaToken) return res.status(400).json({ error: 'CAPTCHA_REQUIRED' });
                const verifyRes = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${captchaToken}`, { method: 'POST' });
                const verifyData: any = await verifyRes.json().catch(() => ({}));
                if (!verifyData?.success) return res.status(400).json({ error: 'CAPTCHA_INVALID' });
            }
        } catch (e: any) {
            if (['RECAPTCHA_NOT_CONFIGURED','CAPTCHA_REQUIRED','CAPTCHA_INVALID'].includes(e?.message)) return res.status(400).json({ error: e.message });
        }
        const result = await query("SELECT * FROM users WHERE phone = ?", [phone]);
        const user = result.rows[0];
        
        if (user && await bcrypt.compare(password, user.password_hash)) {
            // Check 2FA
            if (user.two_factor_enabled) {
                const tempToken = jwt.sign({ id: user.id, role: user.role, requires2FA: true }, JWT_SECRET, { expiresIn: '5m' });
                return res.json({ requires2FA: true, tempToken });
            }

            // Optional: Login OTP via WhatsApp/Email (admin-configurable).
            try {
                const settings = (await getAdminSettingsCached()) || {};
                const otpCfg = settings?.auth?.loginOtp;
                const otpEnabled = otpCfg?.enabled === true;
                const otpRoles = Array.isArray(otpCfg?.roles) && otpCfg.roles.length
                    ? otpCfg.roles
                    : ['rider', 'driver'];

                if (otpEnabled && otpRoles.includes(String(user.role))) {
                    const otpChannels = Array.isArray(otpCfg?.channels) && otpCfg.channels.length
                        ? otpCfg.channels.map((c: any) => String(c).toLowerCase())
                        : ['whatsapp', 'email'];

                    let channel = String(otpCfg?.defaultChannel || otpChannels[0] || 'whatsapp').toLowerCase();
                    if (!otpChannels.includes(channel)) channel = otpChannels[0] || 'whatsapp';

                    // If email is selected but missing, fallback to WhatsApp if allowed.
                    const email = String(user.email || '').trim();
                    if (channel === 'email' && !email) {
                        if (otpChannels.includes('whatsapp')) channel = 'whatsapp';
                        else return res.status(400).json({ error: "EMAIL_REQUIRED" });
                    }

                    const ttlSeconds = Number(otpCfg?.ttlSeconds) || 300;
                    const maxAttempts = Number(otpCfg?.maxAttempts) || 5;

                    const started = await LoginOtpService.start({
                        userId: user.id,
                        phone: user.phone,
                        email,
                        channel: channel === 'email' ? 'email' : 'whatsapp',
                        ttlSeconds,
                        maxAttempts
                    });

                    const otpToken = jwt.sign(
                        { id: user.id, role: user.role, requiresOTP: true, otpSessionId: started.sessionId },
                        JWT_SECRET,
                        { expiresIn: `${Math.max(60, Math.min(900, ttlSeconds))}s` }
                    );

                    return res.json({
                        requiresOTP: true,
                        otpToken,
                        delivery: {
                            channel: started.channel,
                            to: started.maskedTo,
                            expiresAt: started.expiresAtIso
                        }
                    });
                }
            } catch (e: any) {
                // If OTP is enabled but delivery fails, fail login to avoid bypassing configured security policy.
                if (e?.message) {
                    return res.status(503).json({ error: e.message });
                }
                return res.status(503).json({ error: "OTP_DELIVERY_FAILED" });
            }
            
            const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
            const { password_hash, two_factor_secret, ...safeUser } = user;
            log.info('User logged in', { userId: user.id });
            res.json({ token, user: safeUser });
        } else {
            log.warn('Failed login attempt', { phone });
            res.status(401).json({ error: "Invalid credentials" });
        }
    } catch (err) {
        log.error('Login error', err);
        res.status(500).json({ error: "Login failed" });
    }
});

app.post("/api/auth/verify-2fa", async (req, res) => {
    const { tempToken, code } = req.body;
    try {
        const decoded: any = jwt.verify(tempToken, JWT_SECRET);
        if (!decoded.requires2FA) return res.status(400).json({ error: "Invalid token" });
        
        const isValid = await TwoFactorService.verifyToken(decoded.id, code);
        if (isValid) {
            const token = jwt.sign({ id: decoded.id, role: decoded.role }, JWT_SECRET, { expiresIn: '24h' });
            const result = await query("SELECT * FROM users WHERE id = ?", [decoded.id]);
            const { password_hash, two_factor_secret, ...safeUser } = result.rows[0];
            res.json({ token, user: safeUser });
        } else {
            res.status(401).json({ error: "Invalid 2FA code" });
        }
    } catch (err) {
        res.status(401).json({ error: "Invalid or expired token" });
    }
});

app.post("/api/auth/verify", authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const result = await query("SELECT id, name, phone, email, role, avatar, rating, balance, total_trips, loyalty_points, discount_percent FROM users WHERE id = ?", [userId]);
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (user.role === 'driver') {
                try {
                    const driverRes = await query(
                        "SELECT taxi_type_id, service_types, background_check_status, background_check_date, kyc_status, driver_level FROM drivers WHERE id = ?",
                        [userId]
                    );
                    const d = driverRes.rows[0] || {};
                    res.json({
                        user: {
                            ...user,
                            taxiTypeId: d.taxi_type_id || null,
                            serviceTypes: d.service_types || null,
                            backgroundCheckStatus: d.background_check_status || null,
                            backgroundCheckDate: d.background_check_date || null,
                            kycStatus: d.kyc_status || null,
                            driverLevel: d.driver_level || null
                        }
                    });
                    return;
                } catch {}
            }
            res.json({ user });
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (err) {
        log.error('Token verification error', err);
        res.status(500).json({ error: "Verification failed" });
    }
});

app.post("/api/auth/register", async (req, res) => {
    const { name, phone, password, role, captchaToken } = req.body;
    try {
        if (!name || !phone || !password || !role) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        if (!["rider", "driver"].includes(role)) {
            return res.status(400).json({ error: "Invalid role. Allowed: rider, driver" });
        }

        // reCAPTCHA verification (if enabled in admin settings)
        try {
            const settings = (await getAdminSettingsCached()) || {};
            const recaptchaCfg = settings?.auth?.recaptcha;
            if (recaptchaCfg?.enabled && (recaptchaCfg?.applyTo || []).includes('register')) {
                const secret = String(process.env.RECAPTCHA_SECRET_KEY || '').trim();
                if (!secret) return res.status(500).json({ error: 'RECAPTCHA_NOT_CONFIGURED' });
                if (!captchaToken) return res.status(400).json({ error: 'CAPTCHA_REQUIRED' });
                const verifyRes = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${captchaToken}`, { method: 'POST' });
                const verifyData: any = await verifyRes.json().catch(() => ({}));
                if (!verifyData?.success) return res.status(400).json({ error: 'CAPTCHA_INVALID' });
            }
        } catch (e: any) {
            if (e?.message === 'RECAPTCHA_NOT_CONFIGURED' || e?.message === 'CAPTCHA_REQUIRED' || e?.message === 'CAPTCHA_INVALID') throw e;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = generateId();
        
        await query(
            "INSERT INTO users (id, name, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)",
            [userId, name, phone, hashedPassword, role]
        );
        
        const result = await query("SELECT * FROM users WHERE id = ?", [userId]);
        const user = result.rows[0];
        const { password_hash, ...safeUser } = user;
        
        if (role === 'driver') {
            await query("INSERT INTO drivers (id, status) VALUES (?, 'offline')", [safeUser.id]);
        }
        
        await ReferralService.generateCode(userId);

        // OTP on register (if admin enabled it)
        try {
            const settings = (await getAdminSettingsCached()) || {};
            const otpCfg = settings?.auth?.loginOtp;
            const otpEnabled = otpCfg?.enabled === true && otpCfg?.enableOnRegister === true;
            const otpRoles = Array.isArray(otpCfg?.roles) && otpCfg.roles.length ? otpCfg.roles : ['rider', 'driver'];

            if (otpEnabled && otpRoles.includes(String(role))) {
                const otpChannels = Array.isArray(otpCfg?.channels) && otpCfg.channels.length
                    ? otpCfg.channels.map((c: any) => String(c).toLowerCase())
                    : ['whatsapp', 'email'];

                let channel = String(otpCfg?.defaultChannel || otpChannels[0] || 'whatsapp').toLowerCase();
                if (!otpChannels.includes(channel)) channel = otpChannels[0] || 'whatsapp';

                const email = String(safeUser.email || '').trim();
                if (channel === 'email' && !email) {
                    if (otpChannels.includes('whatsapp')) channel = 'whatsapp';
                    else return res.status(400).json({ error: 'EMAIL_REQUIRED' });
                }

                const ttlSeconds = Number(otpCfg?.ttlSeconds) || 300;
                const maxAttempts = Number(otpCfg?.maxAttempts) || 5;

                const started = await LoginOtpService.start({
                    userId,
                    phone: safeUser.phone,
                    email,
                    channel: channel === 'email' ? 'email' : 'whatsapp',
                    ttlSeconds,
                    maxAttempts
                });

                const otpToken = jwt.sign(
                    { id: userId, role: safeUser.role, requiresOTP: true, otpSessionId: started.sessionId },
                    JWT_SECRET,
                    { expiresIn: `${Math.max(60, Math.min(900, ttlSeconds))}s` }
                );

                log.info('User registered (OTP pending)', { userId, role });
                return res.json({
                    requiresOTP: true,
                    otpToken,
                    delivery: { channel: started.channel, to: started.maskedTo, expiresAt: started.expiresAtIso }
                });
            }
        } catch (e: any) {
            if (e?.message) return res.status(503).json({ error: e.message });
            return res.status(503).json({ error: 'OTP_DELIVERY_FAILED' });
        }
        
        log.info('User registered', { userId, role });
        res.json({ user: safeUser });
    } catch (err) {
        log.error('Registration error', err);
        res.status(500).json({ error: "Registration failed. Phone might be taken." });
    }
});

// 2FA Routes
app.post("/api/auth/2fa/setup", authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const userResult = await query("SELECT phone FROM users WHERE id = ?", [userId]);
        const twoFactor = await TwoFactorService.generateSecret(userId, userResult.rows[0].phone);
        res.json(twoFactor);
    } catch (err) {
        log.error('2FA setup error', err);
        res.status(500).json({ error: "2FA setup failed" });
    }
});

app.post("/api/auth/2fa/enable", authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const { token } = req.body;
        const enabled = await TwoFactorService.enable2FA(userId, token);
        if (enabled) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: "Invalid token" });
        }
    } catch (err) {
        res.status(500).json({ error: "Failed to enable 2FA" });
    }
});

app.post("/api/auth/2fa/disable", authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const { password } = req.body;
        const disabled = await TwoFactorService.disable2FA(userId, password);
        if (disabled) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: "Invalid password" });
        }
    } catch (err) {
        res.status(500).json({ error: "Failed to disable 2FA" });
    }
});

// Emergency SOS Routes
app.post("/api/emergency/sos", authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const { rideId, location } = req.body;
        const alert = await EmergencyService.triggerSOS(rideId, userId, location);
        io.emit('sos_alert', alert);
        res.json(alert);
    } catch (err) {
        log.error('SOS trigger error', err);
        res.status(500).json({ error: "Failed to trigger SOS" });
    }
});

app.get("/api/emergency/alerts", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const alerts = await EmergencyService.getActiveAlerts();
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch alerts" });
    }
});

app.post("/api/emergency/resolve", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { alertId, status } = req.body;
        await EmergencyService.resolveAlert(alertId, status);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to resolve alert" });
    }
});

// Promo Code Routes
app.post("/api/promo/validate", authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const { code, fare } = req.body;
        const result = await PromoCodeService.validate(code, fare, userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "Validation failed" });
    }
});

app.post("/api/promo/create", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const promo = await PromoCodeService.create(req.body);
        res.json(promo);
    } catch (err) {
        res.status(500).json({ error: "Failed to create promo code" });
    }
});

app.get("/api/promo/list", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const promos = await PromoCodeService.getAll();
        res.json(promos);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch promo codes" });
    }
});

// Referral Routes
app.get("/api/referral/code", authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const code = await ReferralService.generateCode(userId);
        res.json({ code });
    } catch (err) {
        res.status(500).json({ error: "Failed to generate code" });
    }
});

app.post("/api/referral/apply", authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const { code } = req.body;
        const result = await ReferralService.applyReferral(userId, code);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "Failed to apply referral" });
    }
});

app.get("/api/referral/stats", authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const stats = await ReferralService.getStats(userId);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});
app.get("/api/users/:id", authenticateToken, requireOwnership('id'), async (req, res) => {
    try {
        const userId = firstParam((req.params as any).id);
        const result = await query("SELECT id, name, phone, email, role, avatar, rating, balance, total_trips FROM users WHERE id = ?", [userId]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (e) {
        res.status(500).json({ error: "Error fetching user" });
    }
});

app.put("/api/users/:id", authenticateToken, requireOwnership('id'), async (req, res) => {
    const userId = firstParam((req.params as any).id);
    const schema = z.object({
        name: z.string().min(1).max(80).optional(),
        phone: z.string().min(3).max(30).optional(),
        email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
        avatar: z.string().max(1000).optional(),
    }).strict();

    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues });
    }

    const patch = parsed.data;
    const updates: string[] = [];
    const params: any[] = [];

    try {
        if (patch.phone) {
            const phone = patch.phone.trim();
            const dup = await query("SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1", [phone, userId]);
            if (dup.rows.length > 0) {
                return res.status(409).json({ error: "PHONE_IN_USE" });
            }
            updates.push("phone = ?");
            params.push(phone);
        }

        if (patch.email !== undefined) {
            const emailRaw = patch.email === null ? '' : String(patch.email);
            const email = emailRaw.trim();
            if (email) {
                const dup = await query("SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1", [email, userId]);
                if (dup.rows.length > 0) {
                    return res.status(409).json({ error: "EMAIL_IN_USE" });
                }
                updates.push("email = ?");
                params.push(email);
            } else {
                updates.push("email = NULL");
            }
        }

        if (patch.name) {
            updates.push("name = ?");
            params.push(patch.name.trim());
        }

        if (patch.avatar) {
            updates.push("avatar = ?");
            params.push(patch.avatar.trim());
        }

        if (updates.length === 0) {
            const current = await query("SELECT id, name, phone, email, role, avatar, rating, balance, total_trips FROM users WHERE id = ?", [userId]);
            return res.json(current.rows[0] || {});
        }

        params.push(userId);
        await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

        const updated = await query("SELECT id, name, phone, email, role, avatar, rating, balance, total_trips FROM users WHERE id = ?", [userId]);
        return res.json(updated.rows[0]);
    } catch (e: any) {
        log.error('User update error', e);
        return res.status(500).json({ error: "Update failed" });
    }
});

// Driver Credit (credit-based financial model)
app.get("/api/driver-credit/:driverId", authenticateToken, async (req, res) => {
    const driverId = firstParam((req.params as any).driverId);
    if (!isSelfOrAdmin(req, driverId)) {
        return res.status(403).json({ error: "Forbidden" });
    }
    try {
        const balance = await getDriverCreditBalance(driverId);
        const ledger = await query(
            "SELECT * FROM driver_credit_ledger WHERE driver_id = ? ORDER BY created_at DESC LIMIT 200",
            [driverId]
        );
        res.json({ balance, ledger: ledger.rows });
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch driver credit" });
    }
});

app.post("/api/admin/driver-credit/issue", authenticateToken, requireRole(['admin']), async (req, res) => {
    const adminId = getAuthUser(req)?.id || 'unknown';
    const { driverId, amount, description } = req.body || {};
    if (!driverId || typeof amount !== 'number') {
        return res.status(400).json({ error: "Missing required fields: driverId, amount" });
    }
    try {
        await creditDriverAccount({ driverId, amount, entryType: 'admin_credit', description, createdBy: adminId });
        const balance = await getDriverCreditBalance(driverId);
        res.json({ status: "credited", balance });
    } catch (e: any) {
        res.status(500).json({ error: e?.message || "Credit issue failed" });
    }
});

// Driver Routes
app.get("/api/drivers", async (req, res) => {
  try {
    const { lat, lng } = req.query;
    let result;
    
    if (lat && lng) {
        // Real GPS-based driver fetching with H3 geospatial indexing
        const originHex = latLngToCell(Number(lat), Number(lng), 8);
        const searchHexes = gridDisk(originHex, 2);
        
        result = await query(`
            SELECT d.*, u.name, u.rating, u.phone,
                   (SELECT COUNT(*) FROM rides WHERE driver_id = d.id AND status = 'completed') as total_rides,
                   (SELECT SUM(fare * 0.8) FROM rides WHERE driver_id = d.id AND status = 'completed') as earnings
             FROM drivers d 
             JOIN users u ON d.id = u.id 
             WHERE d.is_active = 1 
             AND d.kyc_status = 'approved'
             AND d.status IN ('available', 'busy')
             AND d.current_lat IS NOT NULL 
             AND d.current_lng IS NOT NULL
             AND d.last_updated > DATE_SUB(NOW(), INTERVAL 30 MINUTE)
            ORDER BY (
                6371 * acos(
                    cos(radians(?)) * cos(radians(d.current_lat)) * 
                    cos(radians(d.current_lng) - radians(?)) + 
                    sin(radians(?)) * sin(radians(d.current_lat))
                )
            ) ASC
            LIMIT 10
        `, [lat, lng, lat]);
    } else {
        result = await query(`
            SELECT d.*, u.name, u.rating, u.phone,
                   (SELECT COUNT(*) FROM rides WHERE driver_id = d.id AND status = 'completed') as total_rides,
                   (SELECT SUM(fare * 0.8) FROM rides WHERE driver_id = d.id AND status = 'completed') as earnings
             FROM drivers d 
             JOIN users u ON d.id = u.id 
             WHERE d.is_active = 1 
             AND d.kyc_status = 'approved'
             AND d.status IN ('available', 'busy', 'offline')
             AND d.current_lat IS NOT NULL 
             AND d.current_lng IS NOT NULL
         `);
    }
    
    res.json(result.rows);
  } catch (err) {
    log.error('Drivers fetch error', err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/drivers/location", authenticateToken, async (req, res) => {
    const { driverId, lat, lng } = req.body;
    if (!driverId || typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({ error: "Invalid location payload" });
    }
    if (!isSelfOrAdmin(req, driverId)) {
        return res.status(403).json({ error: "Forbidden" });
    }
    try {
        const h3Index = latLngToCell(lat, lng, 8);
        await query(
            "UPDATE drivers SET current_lat = ?, current_lng = ?, h3_index = ?, is_active = 1, last_updated = NOW() WHERE id = ?",
            [lat, lng, h3Index, driverId]
        );
        res.json({ status: "updated" });
    } catch (err) {
        log.error('Location update error', err);
        res.status(500).json({ error: "Failed to update location" });
    }
});

app.put("/api/drivers/:id", authenticateToken, requireRole(['admin']), async (req, res) => {
    const { id } = req.params;
    const { name, phone, vehicle, licensePlate, type, baseFare, perKmRate } = req.body;
    
    try {
        if (name || phone) {
            const userUpdates = [];
            const userParams = [];
            
            if (name) {
                userUpdates.push('name = ?');
                userParams.push(name);
            }
            if (phone) {
                userUpdates.push('phone = ?');
                userParams.push(phone);
            }
            
            userParams.push(id);
            await query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userParams);
        }
        
        const driverUpdates = [];
        const driverParams = [];
        
        if (vehicle) {
            driverUpdates.push('vehicle_model = ?');
            driverParams.push(vehicle);
        }
        if (licensePlate) {
            driverUpdates.push('vehicle_plate = ?');
            driverParams.push(licensePlate);
        }
        if (type) {
            driverUpdates.push('vehicle_type = ?');
            driverParams.push(type);
        }
        if (baseFare) {
            driverUpdates.push('base_fare = ?');
            driverParams.push(baseFare);
        }
        if (perKmRate) {
            driverUpdates.push('per_km_rate = ?');
            driverParams.push(perKmRate);
        }
        
        if (driverUpdates.length > 0) {
            driverParams.push(id);
            await query(`UPDATE drivers SET ${driverUpdates.join(', ')} WHERE id = ?`, driverParams);
        }
        
        res.json({ status: "updated" });
    } catch (err) {
        log.error('Driver update error', err);
        res.status(500).json({ error: "Failed to update driver" });
    }
});

app.put("/api/drivers/:id/status", authenticateToken, async (req, res) => {
    const id = firstParam((req.params as any).id);
    const { status } = req.body || {};

    if (!id) return res.status(400).json({ error: "Missing driver id" });
    if (!isSelfOrAdmin(req, id)) return res.status(403).json({ error: "Forbidden" });
    if (!['available', 'busy', 'offline', 'suspended'].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
    }
    // Drivers cannot self-set suspended.
    const u = getAuthUser(req);
    if (u?.role !== 'admin' && status === 'suspended') {
        return res.status(403).json({ error: "Forbidden" });
    }

    // Enforce KYC before allowing a driver to go online/available (Req #9).
    if (u?.role !== 'admin' && status === 'available') {
        try {
            const d = await query("SELECT is_active, kyc_status FROM drivers WHERE id = ? LIMIT 1", [id]);
            const row: any = d.rows?.[0];
            const isActive = row?.is_active === 1 || row?.is_active === true || row?.is_active === '1';
            if (!row || !isActive || row.kyc_status !== 'approved') {
                return res.status(403).json({ error: "KYC not approved" });
            }
        } catch {
            return res.status(500).json({ error: "Failed to verify driver KYC" });
        }
    }

    try {
        await query("UPDATE drivers SET status = ?, last_updated = NOW() WHERE id = ?", [status, id]);
        io.to('admins').emit('driver_status_update', { driverId: id, status });
        res.json({ status: "updated" });
    } catch (err) {
        log.error('Status update error', err);
        res.status(500).json({ error: "Failed to update status" });
    }
});

// Ride Routes
app.post("/api/rides", authenticateToken, async (req, res) => {
    const { riderId, pickup, destination, pickupLoc, destLoc, serviceType, taxiTypeId, proposedFare, scheduledTime, notes, preferredDriverId } = req.body;
    const authUser = getAuthUser(req);
    if (!authUser) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    if (authUser.role !== 'admin' && riderId !== authUser.id) {
        return res.status(403).json({ error: "Forbidden: riderId mismatch" });
    }
    
    try {
        console.log('📝 Ride creation request:', { riderId, pickup, destination, pickupLoc, destLoc, serviceType, proposedFare });
        
        if (!riderId || !pickupLoc || !destLoc || !serviceType) {
            console.error('❌ Missing required fields:', { riderId: !!riderId, pickupLoc: !!pickupLoc, destLoc: !!destLoc, serviceType: !!serviceType });
            return res.status(400).json({ error: "Missing required fields: riderId, pickupLoc, destLoc, serviceType" });
        }
        
        // Validate coordinates
        if (!pickupLoc.lat || !pickupLoc.lng || !destLoc.lat || !destLoc.lng) {
            console.error('❌ Invalid coordinates:', { pickupLoc, destLoc });
            return res.status(400).json({ error: "Invalid coordinates provided" });
        }
        
        const toRad = (deg: number) => deg * (Math.PI / 180);
        const R = 6371;
        const dLat = toRad(destLoc.lat - pickupLoc.lat);
        const dLng = toRad(destLoc.lng - pickupLoc.lng);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(toRad(pickupLoc.lat)) * Math.cos(toRad(destLoc.lat)) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distKm = R * c;
        const distMeters = distKm * 1000;

        const taxiTypeRaw = (taxiTypeId || (req.body as any)?.taxi_type || '').toString().trim();
        const normalizedTaxiTypeId =
            taxiTypeRaw && ['eco', 'plus', 'lux', 'premium'].includes(taxiTypeRaw) ? taxiTypeRaw : null;
        if (taxiTypeRaw && !normalizedTaxiTypeId) {
            return res.status(400).json({ error: "Invalid taxi type" });
        }
        
        const normalizedPreferredDriverId =
            typeof preferredDriverId === 'string' && preferredDriverId.trim()
                ? preferredDriverId.trim()
                : null;

        const proposedFareNum =
            typeof proposedFare === 'number' && Number.isFinite(proposedFare) ? proposedFare : null;
        const finalFare = proposedFareNum ?? Math.max(50, Math.round(distKm * 20 + 40));
        const rideId = generateId();
        
        console.log('💰 Calculated fare:', { distKm: distKm.toFixed(2), finalFare, proposedFare: proposedFareNum });

        // If rider explicitly selected a driver, validate availability up-front.
        if (normalizedPreferredDriverId) {
            const driverCheckSql = normalizedTaxiTypeId
                ? "SELECT id FROM drivers WHERE id = ? AND status = 'available' AND is_active = 1 AND kyc_status = 'approved' AND taxi_type_id = ? LIMIT 1"
                : "SELECT id FROM drivers WHERE id = ? AND status = 'available' AND is_active = 1 AND kyc_status = 'approved' LIMIT 1";
            const driverCheckParams = normalizedTaxiTypeId
                ? [normalizedPreferredDriverId, normalizedTaxiTypeId]
                : [normalizedPreferredDriverId];
            const driverCheck = await query(driverCheckSql, driverCheckParams);
            if (driverCheck.rows.length === 0) {
                return res.status(400).json({ error: "Preferred driver not available" });
            }
        }

        const initialStatus = normalizedPreferredDriverId ? 'requested' : 'searching';
        
        // Insert ride with proper error handling
        await query(
            `INSERT INTO rides (id, rider_id, driver_id, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, fare, proposed_fare, status, distance, service_type, scheduled_time, notes, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                rideId,
                riderId,
                normalizedPreferredDriverId,
                pickup || 'Current Location',
                destination || 'Destination',
                pickupLoc.lat,
                pickupLoc.lng,
                destLoc.lat,
                destLoc.lng,
                finalFare,
                proposedFareNum,
                initialStatus,
                distMeters,
                serviceType,
                scheduledTime || null,
                notes || null
            ]
        );

        // Best-effort store of rider-selected taxi type (column is added via init-db fixups).
        if (normalizedTaxiTypeId) {
            try {
                await query("UPDATE rides SET taxi_type_id = ? WHERE id = ?", [normalizedTaxiTypeId, rideId]);
            } catch { /* ignore */ }
        }
        
        console.log('✅ Ride inserted successfully:', rideId);
        
        const ride = { 
            id: rideId, 
            riderId,
            driverId: normalizedPreferredDriverId as string | null,
            pickup: pickup || 'Current Location',
            destination: destination || 'Destination',
            pickupLocation: pickupLoc,
            destinationLocation: destLoc,
            fare: finalFare, 
            proposedFare: proposedFareNum ?? undefined,
            status: initialStatus,
            serviceType,
            taxiTypeId: normalizedTaxiTypeId || undefined,
            distance: distMeters,
            timestamp: Date.now()
        };
        
        // Dispatch logic:
        // - If rider selected a specific driver: send request only to that driver.
        // - Otherwise: dispatch to nearby available drivers. No auto-accept; driver must accept.
        if (normalizedPreferredDriverId) {
            io.to(normalizedPreferredDriverId).emit("new_ride_request", ride);
            io.to('admins').emit("new_ride_request", { ...ride, dispatchMode: 'preferred' });
        } else {
            try {
                let nearbyDriversResult;

                // Only filter by driver service types for "real" dispatchable services.
                // For meta-services (scheduled/subscription/hotel/etc), dispatch remains broad.
                const shouldFilterByServiceType = ['city', 'airport', 'intercity'].includes(serviceType);

                const fallbackQuery = `
                        SELECT d.id, d.current_lat, d.current_lng, u.name, u.phone, u.rating,
                               d.vehicle_model, d.vehicle_plate, d.vehicle_type
                         FROM drivers d 
                         JOIN users u ON d.id = u.id 
                         WHERE d.status = 'available' 
                         AND d.is_active = 1
                         AND d.kyc_status = 'approved'
                         AND d.current_lat IS NOT NULL 
                         AND d.current_lng IS NOT NULL
                         AND (
                             6371 * acos(
                                 cos(radians(?)) * cos(radians(d.current_lat)) * 
                                cos(radians(d.current_lng) - radians(?)) + 
                                 sin(radians(?)) * sin(radians(d.current_lat))
                             )
                         ) <= 15
                         AND (? IS NULL OR d.taxi_type_id = ?)
                         ORDER BY (
                             6371 * acos(
                                 cos(radians(?)) * cos(radians(d.current_lat)) * 
                                 cos(radians(d.current_lng) - radians(?)) + 
                                sin(radians(?)) * sin(radians(d.current_lat))
                            )
                        ) ASC
                        LIMIT 10
                    `;

                if (shouldFilterByServiceType) {
                    try {
                        // Prefer filtering by supported service types (JSON array) when available.
                        nearbyDriversResult = await query(`
                            SELECT d.id, d.current_lat, d.current_lng, u.name, u.phone, u.rating,
                                   d.vehicle_model, d.vehicle_plate, d.vehicle_type, d.service_types
                             FROM drivers d 
                             JOIN users u ON d.id = u.id 
                             WHERE d.status = 'available' 
                             AND d.is_active = 1
                             AND d.kyc_status = 'approved'
                             AND d.current_lat IS NOT NULL 
                             AND d.current_lng IS NOT NULL
                             AND (
                                 6371 * acos(
                                     cos(radians(?)) * cos(radians(d.current_lat)) * 
                                    cos(radians(d.current_lng) - radians(?)) + 
                                    sin(radians(?)) * sin(radians(d.current_lat))
                                 )
                             ) <= 15
                             AND (d.service_types IS NULL OR JSON_CONTAINS(d.service_types, JSON_QUOTE(?)))
                             AND (? IS NULL OR d.taxi_type_id = ?)
                             ORDER BY (
                                 6371 * acos(
                                     cos(radians(?)) * cos(radians(d.current_lat)) * 
                                     cos(radians(d.current_lng) - radians(?)) + 
                                    sin(radians(?)) * sin(radians(d.current_lat))
                                )
                             ) ASC
                             LIMIT 10
                        `, [pickupLoc.lat, pickupLoc.lng, pickupLoc.lat, serviceType, normalizedTaxiTypeId, normalizedTaxiTypeId, pickupLoc.lat, pickupLoc.lng, pickupLoc.lat]);
                     } catch (e) {
                         // Fallback query for older schemas/data (no JSON_CONTAINS/service_types).
                         nearbyDriversResult = await query(fallbackQuery, [pickupLoc.lat, pickupLoc.lng, pickupLoc.lat, normalizedTaxiTypeId, normalizedTaxiTypeId, pickupLoc.lat, pickupLoc.lng, pickupLoc.lat]);
                     }
                } else {
                    nearbyDriversResult = await query(fallbackQuery, [pickupLoc.lat, pickupLoc.lng, pickupLoc.lat, normalizedTaxiTypeId, normalizedTaxiTypeId, pickupLoc.lat, pickupLoc.lng, pickupLoc.lat]);
                }

                const nearbyDrivers = nearbyDriversResult.rows || [];

                // Notify admins with dispatch summary.
                io.to('admins').emit("new_ride_request", {
                    ...ride,
                    nearbyDrivers: nearbyDrivers.length,
                    dispatchMode: 'nearby'
                });

                // Target only the selected nearby drivers.
                nearbyDrivers.forEach((driver: any) => {
                    const driverDistance = Math.round(Math.sqrt(
                        Math.pow(pickupLoc.lat - driver.current_lat, 2) + 
                        Math.pow(pickupLoc.lng - driver.current_lng, 2)
                    ) * 111 * 1000);
                    
                    io.to(driver.id).emit("new_ride_request", {
                        ...ride,
                        driverDistance,
                        estimatedPickupTime: Math.max(2, Math.round(driverDistance / 500)) + ' min'
                    });
                });
                
                console.log(`📢 Ride ${rideId} dispatched to ${nearbyDrivers.length} nearby drivers`);
            } catch (driverError) {
                console.error('Driver notification error:', driverError);
            }
        }
        
        log.info('Ride created', { rideId, riderId, fare: finalFare, preferredDriverId });
        res.json(ride);
    } catch (err) {
        console.error('❌ Ride creation error:', err);
        log.error('Ride creation error', err);
        
        // More specific error messages
        if (err instanceof Error) {
            if (err.message.includes('FOREIGN KEY')) {
                return res.status(400).json({ error: "Invalid rider ID or driver ID" });
            }
            if (err.message.includes('NOT NULL')) {
                return res.status(400).json({ error: "Missing required database fields" });
            }
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ error: "Duplicate ride request" });
            }
        }
        
        res.status(500).json({ 
            error: "Failed to create ride", 
            details: NODE_ENV === 'development' ? (err as Error).message : undefined 
        });
    }
});

app.post("/api/rides/:id/rate", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { rating, ratedBy } = req.body;
    
    try {
        const field = ratedBy === 'rider' ? 'rider_rating' : 'driver_rating';
        await query(`UPDATE rides SET ${field} = ? WHERE id = ?`, [rating, id]);
        
        const rideRes = await query("SELECT rider_id, driver_id FROM rides WHERE id = ?", [id]);
        if (rideRes.rows.length > 0) {
            const targetUserId = ratedBy === 'rider' ? rideRes.rows[0].driver_id : rideRes.rows[0].rider_id;
            const targetField = ratedBy === 'rider' ? 'driver_rating' : 'rider_rating';
            
            const avgRes = await query(
                `SELECT AVG(${targetField}) as avg_rating FROM rides WHERE ${ratedBy === 'rider' ? 'driver_id' : 'rider_id'} = ? AND ${targetField} IS NOT NULL`,
                [targetUserId]
            );
            
            if (avgRes.rows.length > 0 && avgRes.rows[0].avg_rating) {
                await query("UPDATE users SET rating = ? WHERE id = ?", [parseFloat(avgRes.rows[0].avg_rating), targetUserId]);
            }
        }
        
        res.json({ status: "rated" });
    } catch (err) {
        log.error('Rating error', err);
        res.status(500).json({ error: "Failed to rate" });
    }
});

// Get rides for user
app.get("/api/rides/user/:userId", authenticateToken, requireOwnership('userId'), async (req, res) => {
    const { userId } = req.params;
    const { status } = req.query;
    
    try {
        let query_str = `
            SELECT r.*, 
                   ru.name as rider_name, ru.phone as rider_phone, ru.rating as rider_rating,
                   du.name as driver_name, du.phone as driver_phone, du.rating as driver_rating
            FROM rides r
            LEFT JOIN users ru ON r.rider_id = ru.id
            LEFT JOIN users du ON r.driver_id = du.id
            WHERE (r.rider_id = ? OR r.driver_id = ?)
        `;
        
        const params = [userId, userId];
        
        if (status) {
            query_str += ` AND r.status = ?`;
            params.push(status as string);
        }
        
        query_str += ` ORDER BY r.created_at DESC LIMIT 50`;
        
        const result = await query(query_str, params);
        res.json(result.rows);
    } catch (err) {
        log.error('Fetch rides error', err);
        res.status(500).json({ error: "Failed to fetch rides" });
    }
});

app.put("/api/rides/:id/status", authenticateToken, async (req, res) => {
    const id = firstParam((req.params as any).id);
    const { status, driverId } = req.body;
    
    try {
        const authUser = getAuthUser(req);
        if (!authUser) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const rideAccess = await query("SELECT rider_id, driver_id, status as ride_status FROM rides WHERE id = ?", [id]);
        if (rideAccess.rows.length === 0) {
            return res.status(404).json({ error: "Ride not found" });
        }
        const rideAccessRow = rideAccess.rows[0];
        const isDriverAcceptingSearchingRide =
            status === 'accepted' &&
            !!driverId &&
            authUser.role === 'driver' &&
            authUser.id === driverId &&
            (rideAccessRow.driver_id === null || rideAccessRow.driver_id === '' || typeof rideAccessRow.driver_id === 'undefined') &&
            rideAccessRow.ride_status === 'searching';

        const hasAccess =
            authUser.role === 'admin' ||
            authUser.id === rideAccessRow.rider_id ||
            authUser.id === rideAccessRow.driver_id ||
            isDriverAcceptingSearchingRide;
        if (!hasAccess) {
            return res.status(403).json({ error: "Forbidden" });
        }

        if (driverId && status === 'accepted' && authUser.role !== 'admin' && authUser.id !== driverId) {
            return res.status(403).json({ error: "Forbidden: driver mismatch" });
        }

        if (driverId && status === 'accepted') {
            // Check if ride is still available
            const rideCheck = await query("SELECT status, rider_id, driver_id FROM rides WHERE id = ?", [id]);
            if (rideCheck.rows.length === 0 || !['searching', 'requested'].includes(rideCheck.rows[0].status)) {
                return res.status(400).json({ error: 'Ride no longer available' });
            }
            const rideRow = rideCheck.rows[0];
            const assignedDriverId = (rideRow.driver_id || '').toString().trim();
            if (assignedDriverId && assignedDriverId !== driverId) {
                return res.status(403).json({ error: 'Ride assigned to another driver' });
            }

            // Enforce credit sufficiency before accepting (credit-based model).
            const rideFareRes = await query("SELECT fare FROM rides WHERE id = ?", [id]);
            const fare = Number.parseFloat(rideFareRes.rows[0]?.fare || '0') || 0;
            let commissionRate = 20;
            let fixedFee = 0;
            try {
                const settingsRes = await query("SELECT settings FROM admin_settings WHERE id = 1");
                if (settingsRes.rows.length > 0) {
                    const settings = JSON.parse(settingsRes.rows[0].settings);
                    commissionRate = settings.pricing?.commissionRate || commissionRate;
                    fixedFee = settings.pricing?.driverCreditFeeFixed || 0;
                }
            } catch {}
            const required = (fare * (commissionRate / 100)) + fixedFee;
            if (required > 0) {
                try {
                    // Only check here; debit happens on completion.
                    const bal = await getDriverCreditBalance(driverId);
                    if (bal < required) {
                        return res.status(400).json({ error: "Insufficient driver credit to accept this ride" });
                    }
                } catch {}
            }
            
            const upd = await query(
                "UPDATE rides SET status = ?, driver_id = ?, updated_at = NOW() WHERE id = ? AND status IN ('searching','requested') AND (driver_id IS NULL OR driver_id = '' OR driver_id = ?)",
                [status, driverId, id, driverId]
            );
            const affected = (upd.rows?.[0] as any)?.affectedRows ?? 0;
            if (affected === 0) {
                return res.status(400).json({ error: 'Ride no longer available' });
            }
            await query("UPDATE drivers SET status = 'busy' WHERE id = ?", [driverId]);
            
            // Get driver info
            const driverInfo = await query(`
                SELECT u.name, u.phone, u.rating, d.vehicle_model, d.vehicle_plate, d.current_lat, d.current_lng
                FROM users u 
                JOIN drivers d ON u.id = d.id 
                WHERE u.id = ?
            `, [driverId]);
            
            const driver = driverInfo.rows[0];
            const riderId = rideRow.rider_id;
            
            // Notify rider via socket
            io.to(riderId).emit("ride_accepted", { 
                rideId: id, 
                driverId,
                driver: {
                    name: driver.name,
                    phone: driver.phone,
                    rating: driver.rating,
                    vehicle: driver.vehicle_model,
                    licensePlate: driver.vehicle_plate,
                    location: {
                        lat: driver.current_lat,
                        lng: driver.current_lng
                    }
                }
            });
        } else {
            await query("UPDATE rides SET status = ?, updated_at = NOW() WHERE id = ?", [status, id]);
        }
        
        if (status === 'completed') {
             const rideRes = await query("SELECT driver_id, rider_id, fare FROM rides WHERE id = ?", [id]);
             if (rideRes.rows.length > 0) {
                 const rideData = rideRes.rows[0];
                 await query("UPDATE drivers SET status = 'available' WHERE id = ?", [rideData.driver_id]);
                 
                 const fare = parseFloat(rideData.fare);

                 // Payment model: default cash. If rider has wallet and you want wallet payments, add a payment_method column and branch here.
                 // For now, we avoid silently charging rider wallet in production credit-based deployments.

                 let commissionRate = 20;
                 let fixedFee = 0;
                 try {
                     const settingsRes = await query("SELECT settings FROM admin_settings WHERE id = 1");
                     if (settingsRes.rows.length > 0) {
                         const settings = JSON.parse(settingsRes.rows[0].settings);
                         commissionRate = settings.pricing?.commissionRate || 20;
                         fixedFee = settings.pricing?.driverCreditFeeFixed || 0;
                     }
                 } catch(e) {}
                 
                 const commission = fare * (commissionRate / 100);
                 const driverNetEarnings = fare - commission;
                 // Track driver earnings (cash) in drivers table, not wallet balance.
                 try {
                     await query("UPDATE drivers SET earnings = COALESCE(earnings, 0) + ? WHERE id = ?", [driverNetEarnings, rideData.driver_id]);
                 } catch {}
                 // Deduct platform commission + fixed fee from driver credit.
                 try {
                     if (commission > 0) {
                         await debitDriverAccount({
                             driverId: rideData.driver_id,
                             amount: commission,
                             rideId: id,
                             entryType: 'ride_commission',
                             description: `Commission ${commissionRate}% for ride ${id}`,
                             enforceSufficient: false
                         });
                         await recordSystemRevenue({ rideId: id, driverId: rideData.driver_id, amount: commission, revenueType: 'commission' });
                     }
                     if (fixedFee > 0) {
                         await debitDriverAccount({
                             driverId: rideData.driver_id,
                             amount: fixedFee,
                             rideId: id,
                             entryType: 'ride_fee',
                             description: `Fixed platform fee for ride ${id}`,
                             enforceSufficient: false
                         });
                         await recordSystemRevenue({ rideId: id, driverId: rideData.driver_id, amount: fixedFee, revenueType: 'fee' });
                     }
                 } catch (creditErr) {
                     log.error('Driver credit deduction failed', creditErr);
                 }
                 
                 await ReferralService.completeReferral(rideData.rider_id);
                 
                 const riderRes = await query("SELECT loyalty_points FROM users WHERE id = ?", [rideData.rider_id]);
                 if (riderRes.rows.length > 0) {
                     const points = riderRes.rows[0].loyalty_points;
                     let discount = 0;
                     if (points >= 50) discount = 15;
                     else if (points >= 30) discount = 10;
                     else if (points >= 10) discount = 5;
                     
                     await query("UPDATE users SET discount_percent = ?, total_trips = total_trips + 1, loyalty_points = loyalty_points + 1 WHERE id = ?", [discount, rideData.rider_id]);
                 }
             }
        }

        const result = await query("SELECT * FROM rides WHERE id = ?", [id]);
        const ride = result.rows[0];
        
        if (ride) {
            io.to(ride.rider_id).emit("ride_status_update", ride);
            if (ride.driver_id) {
                io.to(ride.driver_id).emit("ride_status_update", ride);
            }
            io.to('admins').emit("ride_status_update", ride);
            res.json(ride);
        } else {
            res.status(404).json({ error: "Ride not found" });
        }
    } catch (err) {
        log.error('Ride status update error', err);
        res.status(500).json({ error: "Failed to update status" });
    }
});

// Wallet & Transactions
app.get("/api/wallet/:userId", authenticateToken, requireOwnership('userId'), async (req, res) => {
    try {
        const userId = firstParam((req.params as any).userId);
        const txRes = await query("SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC", [userId]);
        const userRes = await query("SELECT balance FROM users WHERE id = ?", [userId]);
        
        // Also fetch credit requests for drivers
        let creditRequests = [];
        let driverCreditBalance: number | null = null;
        const userRoleRes = await query("SELECT role FROM users WHERE id = ?", [userId]);
        if (userRoleRes.rows.length > 0 && userRoleRes.rows[0].role === 'driver') {
             const crRes = await query("SELECT * FROM credit_requests WHERE driver_id = ? ORDER BY created_at DESC", [userId]);
             creditRequests = crRes.rows;
             try {
                 driverCreditBalance = await getDriverCreditBalance(userId);
             } catch {
                 driverCreditBalance = null;
             }
        }

        res.json({
            balance: userRes.rows[0]?.balance || 0,
            transactions: txRes.rows,
            creditRequests,
            driverCreditBalance
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Wallet error" });
    }
});

// Convenience alias: current user's wallet (matches /api/wallet expected by some tools/tests)
app.get("/api/wallet", authenticateToken, async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    // Delegate to main wallet handler
    (req.params as any).userId = user.id;
    return (app._router as any).handle(req, res, () => {});
});

app.post("/api/wallet/withdraw", authenticateToken, async (req, res) => {
    const { driverId, amount, method, details } = req.body;
    if (!driverId || typeof amount !== 'number' || !method) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    if (!isSelfOrAdmin(req, driverId)) {
        return res.status(403).json({ error: "Forbidden" });
    }
    try {
        const withdrawalId = generateId();
        await query(
            "INSERT INTO withdrawal_requests (id, driver_id, amount, method, account_details) VALUES (?, ?, ?, ?, ?)",
            [withdrawalId, driverId, amount, method, details]
        );
        // Deduct from balance immediately? Or hold? Let's deduct.
        await query("UPDATE users SET balance = balance - ? WHERE id = ?", [amount, driverId]);
        
        await query(
            "INSERT INTO transactions (id, user_id, amount, type, status, description) VALUES (?, ?, ?, 'debit', 'pending', 'Withdrawal Request')",
            [generateId(), driverId, amount]
        );

        res.json({ status: "requested" });
    } catch (e) {
        res.status(500).json({ error: "Request failed" });
    }
});

app.post("/api/wallet/create-payment-intent", authenticateToken, async (req, res) => {
    const { amount, currency = 'usd' } = req.body;
    
    if (!stripe) {
        return res.status(500).json({ error: "Stripe is not configured on the server." });
    }

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe expects cents
            currency,
            automatic_payment_methods: {
                enabled: true,
            },
        });
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (e: any) {
        console.error("Stripe error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/wallet/topup", authenticateToken, async (req, res) => {
    const { userId, amount } = req.body;
    if (!userId || typeof amount !== 'number') {
        return res.status(400).json({ error: "Missing required fields" });
    }
    if (!isSelfOrAdmin(req, userId)) {
        return res.status(403).json({ error: "Forbidden" });
    }
    try {
        // 1. Add Transaction
        await query(
            "INSERT INTO transactions (id, user_id, amount, type, status, description) VALUES (?, ?, ?, 'credit', 'completed', 'Wallet Top Up')",
            [generateId(), userId, amount]
        );
        // 2. Update Balance
        await query("UPDATE users SET balance = balance + ? WHERE id = ?", [amount, userId]);
        
        res.json({ status: "success", amount });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Topup failed" });
    }
});

app.post("/api/wallet/credit-request", authenticateToken, async (req, res) => {
    const { driverId, amount } = req.body;
    if (!driverId || typeof amount !== 'number') {
        return res.status(400).json({ error: "Missing required fields" });
    }
    if (!isSelfOrAdmin(req, driverId)) {
        return res.status(403).json({ error: "Forbidden" });
    }
    try {
        await query(
            "INSERT INTO credit_requests (id, driver_id, amount) VALUES (?, ?, ?)",
            [generateId(), driverId, amount]
        );
        res.json({ status: "requested" });
    } catch (e) {
        res.status(500).json({ error: "Request failed" });
    }
});

// Admin Financials
app.get("/api/admin/financials", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const withdrawals = await query(`
            SELECT w.*, u.name as driver_name 
            FROM withdrawal_requests w 
            JOIN users u ON w.driver_id = u.id 
            ORDER BY w.created_at DESC
        `);
        const credits = await query(`
            SELECT c.*, u.name as driver_name 
            FROM credit_requests c 
            JOIN users u ON c.driver_id = u.id 
            ORDER BY c.created_at DESC
        `);
        
        res.json({
            withdrawals: withdrawals.rows,
            creditRequests: credits.rows
        });
    } catch (e) {
        res.status(500).json({ error: "Error fetching financials" });
    }
});

app.post("/api/admin/financials/approve", authenticateToken, requireRole(['admin']), async (req, res) => {
    const { id, type, status } = req.body; // type: 'withdrawal' | 'credit'
    
    try {
        if (type === 'credit') {
            const adminId = getAuthUser(req)?.id || 'unknown';
            await query("UPDATE credit_requests SET status = ?, processed_at = NOW() WHERE id = ?", [status, id]);
            if (status === 'approved') {
                // Fetch amount and driverId
                const creditReqRes = await query("SELECT * FROM credit_requests WHERE id = ?", [id]);
                const creditReq = creditReqRes.rows[0];
                if (creditReq) {
                    // Credit-based model: issue operational credit to driver credit account (not wallet balance).
                    await creditDriverAccount({
                        driverId: creditReq.driver_id,
                        amount: Number(creditReq.amount),
                        entryType: 'admin_credit',
                        description: 'Credit request approved',
                        createdBy: adminId
                    });
                }
            }
        } else if (type === 'withdrawal') {
            await query("UPDATE withdrawal_requests SET status = ?, processed_at = NOW() WHERE id = ?", [status, id]);
            if (status === 'rejected') {
                // Refund
                const reqRes = await query("SELECT * FROM withdrawal_requests WHERE id = ?", [id]);
                const req = reqRes.rows[0];
                if (req) {
                    await query("UPDATE users SET balance = balance + ? WHERE id = ?", [req.amount, req.driver_id]);
                     await query(
                        "INSERT INTO transactions (id, user_id, amount, type, status, description) VALUES (?, ?, ?, 'credit', 'completed', 'Withdrawal Refund')",
                        [generateId(), req.driver_id, req.amount]
                    );
                }
            } else if (status === 'approved') {
                 // Update transaction status to completed if we had a pending one? 
                 // For now, just marking request as approved is enough.
            }
        }
        res.json({ status: "processed" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Processing failed" });
    }
});

// Chat Routes
app.get("/api/chat/threads", authenticateToken, async (req, res) => {
    const authUser = getAuthUser(req);
    if (!authUser) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const userId = authUser.id;

        // Discover a primary admin account to use as Support contact.
        let supportUser: any = null;
        try {
            const supportRes = await query(
                "SELECT id, name, role, phone FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
            );
            supportUser = supportRes.rows?.[0] || null;
        } catch {
            supportUser = null;
        }

        // Fetch recent messages for this user (enough to build a threads list + unread counts).
        const msgRes = await query(
            "SELECT id, sender_id, recipient_id, message, is_read, created_at FROM chat_messages WHERE sender_id = ? OR recipient_id = ? ORDER BY created_at DESC LIMIT 2000",
            [userId, userId]
        );

        const threadsByOther = new Map<string, { otherId: string; lastMessage: string; lastAt: any; unread: number }>();
        const otherIds = new Set<string>();

        for (const msg of msgRes.rows || []) {
            const senderId = msg.sender_id;
            const recipientId = msg.recipient_id;
            const otherId = senderId === userId ? recipientId : senderId;
            if (!otherId) continue;

            otherIds.add(otherId);

            if (!threadsByOther.has(otherId)) {
                threadsByOther.set(otherId, {
                    otherId,
                    lastMessage: String(msg.message || ''),
                    lastAt: msg.created_at,
                    unread: 0
                });
            }

            const isUnread = recipientId === userId && senderId === otherId && (msg.is_read === 0 || msg.is_read === false);
            if (isUnread) {
                const current = threadsByOther.get(otherId);
                if (current) current.unread += 1;
            }
        }

        const ids = Array.from(otherIds);
        const usersById = new Map<string, any>();

        if (ids.length > 0) {
            const placeholders = ids.map(() => '?').join(',');
            const usersRes = await query(
                `SELECT id, name, role, phone FROM users WHERE id IN (${placeholders})`,
                ids
            );
            for (const u of usersRes.rows || []) {
                usersById.set(u.id, u);
            }
        }

        const threads = Array.from(threadsByOther.values()).map((t) => {
            const other = usersById.get(t.otherId) || {};
            const lastAt = t.lastAt instanceof Date ? t.lastAt.toISOString() : t.lastAt;
            return {
                id: t.otherId,
                name: other.name || 'Unknown',
                role: other.role || 'user',
                phone: other.phone || null,
                lastMessage: t.lastMessage || '',
                lastAt: lastAt || null,
                unread: t.unread || 0,
                pinned: false
            };
        });

        // Ensure Support is always available as a thread (even with no history yet).
        if (supportUser?.id && supportUser.id !== userId && !threads.find(t => t.id === supportUser.id)) {
            threads.push({
                id: supportUser.id,
                name: supportUser.name || 'Support',
                role: supportUser.role || 'admin',
                phone: supportUser.phone || null,
                lastMessage: 'Support',
                lastAt: null,
                unread: 0,
                pinned: true
            });
        }

        // Sort: pinned first, then newest activity.
        threads.sort((a: any, b: any) => {
            const ap = a.pinned ? 1 : 0;
            const bp = b.pinned ? 1 : 0;
            if (ap !== bp) return bp - ap;
            const at = a.lastAt ? new Date(a.lastAt).getTime() : 0;
            const bt = b.lastAt ? new Date(b.lastAt).getTime() : 0;
            return bt - at;
        });

        res.json(threads);
    } catch (e) {
        console.error('Chat threads error:', e);
        res.status(500).json({ error: "Chat error" });
    }
});

app.post("/api/auth/verify-otp", async (req, res) => {
    const schema = z.object({
        otpToken: z.string().min(10),
        code: z.string().min(4).max(8)
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues });
    }

    const { otpToken, code } = parsed.data;
    try {
        const decoded: any = jwt.verify(otpToken, JWT_SECRET);
        if (!decoded?.requiresOTP || !decoded?.otpSessionId || !decoded?.id) {
            return res.status(400).json({ error: "Invalid OTP token" });
        }

        const ok = await LoginOtpService.verifyAndConsume({
            sessionId: decoded.otpSessionId,
            userId: decoded.id,
            code
        });

        if (!ok) {
            return res.status(401).json({ error: "Invalid OTP code" });
        }

        const token = jwt.sign({ id: decoded.id, role: decoded.role }, JWT_SECRET, { expiresIn: '24h' });
        const result = await query("SELECT * FROM users WHERE id = ?", [decoded.id]);
        const { password_hash, two_factor_secret, ...safeUser } = result.rows[0];
        return res.json({ token, user: safeUser });
    } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
});

app.get("/api/chat/:userId/:otherId", authenticateToken, async (req, res) => {
    const authUser = getAuthUser(req);
    if (!authUser) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { userId, otherId } = req.params;
    if (authUser.role !== 'admin' && authUser.id !== userId && authUser.id !== otherId) {
        return res.status(403).json({ error: "Forbidden" });
    }
    try {
        const result = await query(
            `SELECT * FROM chat_messages 
             WHERE (sender_id = ? AND recipient_id = ?) 
                OR (sender_id = ? AND recipient_id = ?) 
             ORDER BY created_at ASC`,
            [req.params.userId, req.params.otherId, req.params.otherId, req.params.userId]
        );

        // Mark messages as read for the viewing user (do not alter read state when admin is inspecting).
        try {
            if (authUser.id === userId) {
                await query(
                    "UPDATE chat_messages SET is_read = true WHERE sender_id = ? AND recipient_id = ? AND is_read = false",
                    [otherId, userId]
                );
            }
        } catch (e) {
            console.warn('Failed to mark chat as read:', (e as any)?.message || e);
        }
        
        // Format messages for frontend
        const messages = result.rows.map((msg: any) => ({
            id: msg.id,
            text: msg.message,
            sender: msg.sender_id === req.params.userId ? 'me' : 'other',
            time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })
        }));
        
        res.json(messages);
    } catch (e) {
        console.error('Chat fetch error:', e);
        res.status(500).json({ error: "Chat error" });
    }
});

// Admin Routes
app.get("/api/admin/rides", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const result = await query(`
            SELECT r.*, 
                   ru.name as rider_name, ru.phone as rider_phone,
                   du.name as driver_name, du.phone as driver_phone
            FROM rides r
            LEFT JOIN users ru ON r.rider_id = ru.id
            LEFT JOIN users du ON r.driver_id = du.id
            ORDER BY r.created_at DESC
            LIMIT 500
        `);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: "Error fetching rides" });
    }
});

app.get("/api/admin/users", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                u.id, u.name, u.phone, u.email, u.role, u.rating, u.balance, u.total_trips, u.created_at,
                d.kyc_status as kycStatus,
                d.driver_level as driverLevel,
                d.taxi_type_id as taxi_type
            FROM users u
            LEFT JOIN drivers d ON d.id = u.id
            ORDER BY u.created_at DESC
        `);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: "Error fetching users" });
    }
});

// Admin: approve/reject driver KYC and optionally assign taxi type + initial credit.
app.post("/api/admin/drivers/:id/kyc", authenticateToken, requireRole(['admin']), async (req, res) => {
    const driverId = firstParam((req.params as any).id);
    const body = req.body || {};

    const statusRaw = (body.status || body.action || 'approved').toString().toLowerCase();
    const targetStatus =
        statusRaw === 'reject' || statusRaw === 'rejected' ? 'rejected' :
        statusRaw === 'pending' ? 'pending' :
        statusRaw === 'unverified' ? 'unverified' :
        'approved';

    const taxiTypeIdRaw = (body.taxi_type || body.taxiTypeId || '').toString().trim();
    const taxiTypeId = taxiTypeIdRaw || 'eco';

    const initialCreditNum = Number(body.initial_credit ?? body.initialCredit ?? 0);

    try {
        // Validate taxi type when approving (must exist/active).
        if (targetStatus === 'approved') {
            const tt = await query("SELECT id FROM taxi_types WHERE id = ? AND is_active = 1 LIMIT 1", [taxiTypeId]);
            if (tt.rows.length === 0) {
                return res.status(400).json({ error: "Invalid taxi type" });
            }
        }

        // Update KYC status and taxi type assignment.
        const updateSql =
            targetStatus === 'approved'
                ? "UPDATE drivers SET kyc_status = ?, taxi_type_id = ?, kyc_updated_at = NOW() WHERE id = ?"
                : "UPDATE drivers SET kyc_status = ?, kyc_updated_at = NOW() WHERE id = ?";
        const updateParams =
            targetStatus === 'approved'
                ? [targetStatus, taxiTypeId, driverId]
                : [targetStatus, driverId];

        const upd = await query(updateSql, updateParams);
        const affected = (upd.rows?.[0] as any)?.affectedRows ?? 0;
        if (affected === 0) {
            return res.status(404).json({ error: "Driver not found" });
        }

        // Issue initial operational credit (credit-based model).
        if (targetStatus === 'approved' && Number.isFinite(initialCreditNum) && initialCreditNum > 0) {
            const adminId = getAuthUser(req)?.id || 'unknown';
            await creditDriverAccount({
                driverId,
                amount: initialCreditNum,
                entryType: 'admin_credit',
                description: 'Initial credit after KYC approval',
                createdBy: adminId
            });
        }

        res.json({ status: "updated", kycStatus: targetStatus, taxiTypeId: targetStatus === 'approved' ? taxiTypeId : undefined });
    } catch (e: any) {
        res.status(500).json({ error: e?.message || "KYC update failed" });
    }
});

app.put("/api/admin/users/:id/status", authenticateToken, requireRole(['admin']), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    try {
        await query("UPDATE users SET status = ? WHERE id = ?", [status, id]);
        if (status === 'suspended') {
            await query("UPDATE drivers SET status = 'suspended' WHERE id = ?", [id]);
        }
        res.json({ status: "updated" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update status" });
    }
});

app.get("/api/admin/settings", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const result = await query("SELECT settings FROM admin_settings WHERE id = 1");
        if (result.rows.length > 0) {
            const settings = JSON.parse(result.rows[0].settings);
            res.json(settings);
        } else {
            res.status(404).json({ error: "Settings not found" });
        }
    } catch (e) {
        res.status(500).json({ error: "Settings error" });
    }
});

app.put("/api/admin/settings", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const settings = JSON.stringify(req.body);
        await query("UPDATE admin_settings SET settings = ?, updated_at = NOW() WHERE id = 1", [settings]);
        // Keep routing/provider decisions consistent immediately after save without waiting for cache TTL.
        setAdminSettingsCached(req.body || null);
        res.json({ status: "updated" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Update failed" });
    }
});

// Admin: Validate routing provider / API key configuration.
// This never returns or exposes API keys; it only checks that a request succeeds.
app.post("/api/admin/routing/test", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const settings = (await getAdminSettingsCached()) || {};
        const provider = String(req.body?.provider || settings?.routingProvider || 'ors').toLowerCase();

        const startCandidate = req.body?.start || settings?.system?.defaultCenter;
        const start: LatLng = isValidLatLng(startCandidate)
            ? startCandidate
            : { lat: 34.5553, lng: 69.2075 }; // Kabul default

        const endCandidate = req.body?.end;
        const end: LatLng = isValidLatLng(endCandidate)
            ? endCandidate
            : { lat: start.lat + 0.01, lng: start.lng + 0.01 };

        let route: RouteData | null = null;
        let used = provider;

        if (provider === 'ors') {
            const key = String(settings?.apiKeys?.ors || '').trim();
            if (!key) return res.status(400).json({ ok: false, error: 'ORS_API_KEY_MISSING' });
            route = await routeWithORS(start, end, key);
            used = 'ors';
        } else if (provider === 'mapbox') {
            const key = String(settings?.apiKeys?.mapbox || '').trim();
            if (!key) return res.status(400).json({ ok: false, error: 'MAPBOX_ACCESS_TOKEN_MISSING' });
            route = await routeWithMapbox(start, end, key);
            used = 'mapbox';
        } else if (provider === 'osrm') {
            route = await routeWithOSRM(start, end);
            used = 'osrm';
        } else if (provider === 'mock') {
            route = buildMockRoute(start, end);
            used = 'mock';
        } else {
            return res.status(400).json({ ok: false, error: 'UNKNOWN_PROVIDER' });
        }

        return res.json({ ok: true, provider: used, distance: route.distance, duration: route.duration });
    } catch (e: any) {
        log.warn('Routing test failed', { error: e?.message || String(e) });
        return res.status(400).json({ ok: false, error: e?.message || "Routing test failed" });
    }
});

app.get("/api/admin/system-settings", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const result = await query("SELECT * FROM system_settings WHERE id = 1");
        if (result.rows.length > 0) {
            return res.json(result.rows[0]);
        }

        const fallback = await query("SELECT settings FROM admin_settings WHERE id = 1");
        if (fallback.rows.length > 0) {
            const parsed = JSON.parse(fallback.rows[0].settings);
            return res.json(parsed);
        }
        return res.status(404).json({ error: "System settings not found" });
    } catch (e) {
        return res.status(500).json({ error: "Failed to fetch system settings" });
    }
});

app.put("/api/admin/system-settings", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const settings = req.body || {};
        const sql =
            db.provider === 'postgres'
                ? `INSERT INTO system_settings 
                   (id, map_provider, default_zoom, default_center_lat, default_center_lng, primary_color, secondary_color, features)
                   VALUES (1, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (id) DO UPDATE SET
                     map_provider = EXCLUDED.map_provider,
                     default_zoom = EXCLUDED.default_zoom,
                     default_center_lat = EXCLUDED.default_center_lat,
                     default_center_lng = EXCLUDED.default_center_lng,
                     primary_color = EXCLUDED.primary_color,
                     secondary_color = EXCLUDED.secondary_color,
                     features = EXCLUDED.features,
                     updated_at = NOW()`
                : `INSERT INTO system_settings 
                   (id, map_provider, default_zoom, default_center_lat, default_center_lng, primary_color, secondary_color, features)
                   VALUES (1, ?, ?, ?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE
                     map_provider = VALUES(map_provider),
                     default_zoom = VALUES(default_zoom),
                     default_center_lat = VALUES(default_center_lat),
                     default_center_lng = VALUES(default_center_lng),
                     primary_color = VALUES(primary_color),
                     secondary_color = VALUES(secondary_color),
                     features = VALUES(features)`;
        await query(sql, [
            settings.map_provider || settings.mapProvider || 'osm',
            settings.default_zoom || settings.defaultZoom || 15,
            settings.default_center_lat || settings.defaultCenter?.lat || 34.5553,
            settings.default_center_lng || settings.defaultCenter?.lng || 69.2075,
            settings.primary_color || settings.primaryColor || '#3B82F6',
            settings.secondary_color || settings.secondaryColor || '#10B981',
            JSON.stringify(settings.features || {})
        ]);
        res.json({ status: "updated" });
    } catch (e) {
        res.status(500).json({ error: "Failed to update system settings" });
    }
});

app.post("/api/admin/log", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const adminId = getAuthUser(req)?.id || 'unknown';
        const { action, targetType, targetId, oldValues, newValues } = req.body || {};
        await query(
            `INSERT INTO admin_logs (admin_id, action, target_type, target_id, old_values, new_values, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                adminId,
                action || 'unknown',
                targetType || null,
                targetId || null,
                oldValues || null,
                newValues || null,
                (req.ip || '').toString(),
                (req.headers['user-agent'] || '').toString()
            ]
        );
        res.json({ status: "logged" });
    } catch (e) {
        res.status(500).json({ error: "Failed to log action" });
    }
});

app.get("/api/admin/health/database", authenticateToken, requireRole(['admin']), async (req, res) => {
    const started = Date.now();
    try {
        await query("SELECT 1 as ok");
        const latencyMs = Date.now() - started;
        res.json({ status: "healthy", message: `Database OK (${latencyMs}ms)` });
    } catch (e: any) {
        res.status(500).json({ status: "error", message: e?.message || "Database health check failed" });
    }
});

app.get("/api/admin/test/integration", authenticateToken, requireRole(['admin']), async (req, res) => {
    const checks: Array<{ name: string; ok: boolean }> = [];
    try {
        const tablesToCheck = ['users', 'drivers', 'rides', 'transactions', 'admin_settings', 'taxi_types'];
        for (const table of tablesToCheck) {
            try {
                await query(`SELECT COUNT(*) as count FROM ${table}`);
                checks.push({ name: table, ok: true });
            } catch {
                checks.push({ name: table, ok: false });
            }
        }
        const ok = checks.every(c => c.ok);
        res.json({ status: ok ? "ok" : "degraded", results: checks });
    } catch (e) {
        res.status(500).json({ status: "error", results: checks });
    }
});

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadsDir),
        filename: (_req, file, cb) => {
            const safeOriginal = (file.originalname || "file")
                .replace(/[^\w.\-]+/g, "_")
                .slice(0, 80);
            const ext = path.extname(safeOriginal) || "";
            const base = safeOriginal.replace(new RegExp(`${ext}$`), "");
            cb(null, `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${base}${ext}`);
        }
    }),
    limits: { fileSize: 8 * 1024 * 1024 } // 8MB
});

app.post("/api/admin/upload", authenticateToken, requireRole(['admin']), upload.single("file"), async (req, res) => {
    // 1) Multipart upload (preferred)
    if ((req as any).file) {
        const file = (req as any).file as Express.Multer.File;
        return res.json({ url: `/uploads/${file.filename}` });
    }

    // 2) Backward compatibility: JSON { dataUrl }
    const { dataUrl } = (req.body || {}) as any;
    if (dataUrl && typeof dataUrl === "string") {
        return res.json({ url: dataUrl });
    }

    return res.status(400).json({ error: "No upload received. Send multipart field 'file' or JSON 'dataUrl'." });
});

// Admin Taxi Types Management
app.get("/api/admin/taxi-types", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const result = await query("SELECT * FROM taxi_types ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: "Error fetching taxi types" });
    }
});

app.post("/api/admin/taxi-types", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const b = req.body || {};
        const taxiTypeId = b.id || generateId();
        const nameFa = b.name_fa ?? b.nameFa ?? '';
        const nameEn = b.name_en ?? b.name ?? b.nameFa ?? '';
        const descFa = b.description_fa ?? b.descriptionFa ?? null;
        const descEn = b.description_en ?? b.descriptionEn ?? null;
        const baseFare = Number(b.base_fare ?? b.baseFare ?? 0);
        const perKmRate = Number(b.per_km_rate ?? b.perKmRate ?? 0);
        const color = b.color ?? '#10B981';
        const imagePath = b.image_path ?? b.imagePath ?? null;
        const features = b.features != null ? JSON.stringify(b.features) : null;
        
        await query(
            "INSERT INTO taxi_types (id, name_fa, name_en, description_fa, description_en, base_fare, per_km_rate, color, image_path, features, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
            [taxiTypeId, nameFa, nameEn, descFa, descEn, baseFare, perKmRate, color, imagePath, features]
        );
        
        res.json({ id: taxiTypeId, status: "created" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to create taxi type" });
    }
});

app.put("/api/admin/taxi-types/:id", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const b = req.body || {};
        // Support both camelCase (frontend) and snake_case field names
        const nameFa = b.name_fa ?? b.nameFa ?? null;
        const nameEn = b.name_en ?? b.name ?? b.nameFa ?? null;
        const descFa = b.description_fa ?? b.descriptionFa ?? null;
        const descEn = b.description_en ?? b.descriptionEn ?? null;
        const baseFare = b.base_fare ?? b.baseFare ?? null;
        const perKmRate = b.per_km_rate ?? b.perKmRate ?? null;
        const color = b.color ?? null;
        const imagePath = b.image_path ?? b.imagePath ?? null;
        const features = b.features != null ? JSON.stringify(b.features) : null;
        const minRating = b.min_rating ?? b.minRating ?? null;
        const minRides = b.min_rides ?? b.minRides ?? null;
        const isActive = b.is_active ?? b.isActive ?? null;

        const sets: string[] = ['updated_at = NOW()'];
        const params: any[] = [];
        const add = (col: string, val: any) => { if (val !== null && val !== undefined) { sets.push(`${col} = ?`); params.push(val); } };

        add('name_fa', nameFa);
        add('name_en', nameEn);
        add('description_fa', descFa);
        add('description_en', descEn);
        add('base_fare', baseFare !== null ? Number(baseFare) : null);
        add('per_km_rate', perKmRate !== null ? Number(perKmRate) : null);
        add('color', color);
        add('image_path', imagePath);
        add('features', features);
        add('min_rating', minRating !== null ? Number(minRating) : null);
        add('min_rides', minRides !== null ? Number(minRides) : null);
        if (isActive !== null && isActive !== undefined) { sets.push('is_active = ?'); params.push(isActive === true || isActive === 1 || isActive === 'true' || isActive === '1'); }

        params.push(id);
        await query(`UPDATE taxi_types SET ${sets.join(', ')} WHERE id = ?`, params);
        res.json({ status: "updated" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to update taxi type" });
    }
});

app.delete("/api/admin/taxi-types/:id", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        await query("DELETE FROM taxi_types WHERE id = ?", [id]);
        res.json({ status: "deleted" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to delete taxi type" });
    }
});

// System Monitoring API
app.get("/api/admin/system-metrics", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const activeUsers = await query("SELECT COUNT(DISTINCT rider_id) as count FROM rides WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)");
        const activeDrivers = await query("SELECT COUNT(*) as count FROM drivers WHERE status = 'available' AND last_updated > DATE_SUB(NOW(), INTERVAL 30 MINUTE)");
        const activeRides = await query("SELECT COUNT(*) as count FROM rides WHERE status IN ('searching', 'accepted', 'in_progress')");
        const socketConnections = io.engine.clientsCount;

        const dbStarted = Date.now();
        await query("SELECT 1 as ok");
        const dbResponseTime = Date.now() - dbStarted;

        const metricsText = metricsService.getMetrics();
        const requestsMatch = metricsText.match(/http_requests_total (\d+)/);
        const reqDurationSumMatch = metricsText.match(/http_request_duration_seconds_sum ([\d.]+)/);
        const reqDurationCountMatch = metricsText.match(/http_request_duration_seconds_count (\d+)/);
        const totalRequests = requestsMatch ? parseInt(requestsMatch[1], 10) : 0;
        const reqDurationSum = reqDurationSumMatch ? parseFloat(reqDurationSumMatch[1]) : 0;
        const reqDurationCount = reqDurationCountMatch ? parseInt(reqDurationCountMatch[1], 10) : 0;
        const avgResponseMs = reqDurationCount > 0 ? (reqDurationSum / reqDurationCount) * 1000 : 0;

        const cpuCount = os.cpus().length || 1;
        const load1m = os.loadavg()[0];
        const cpuUsagePercent = Math.min(100, Math.round((load1m / cpuCount) * 100));
        const mem = process.memoryUsage();
        const memoryPercent = mem.heapTotal > 0 ? Math.round((mem.heapUsed / mem.heapTotal) * 100) : 0;

        res.json({
            server: {
                cpu: cpuUsagePercent,
                memory: Math.min(100, memoryPercent),
                disk: 0,
                uptime: process.uptime() * 1000,
                status: 'healthy'
            },
            database: {
                connections: parseInt(process.env.DB_POOL_SIZE || '10', 10),
                queries: totalRequests,
                responseTime: dbResponseTime,
                status: 'healthy'
            },
            realtime: {
                activeUsers: activeUsers.rows[0].count,
                activeDrivers: activeDrivers.rows[0].count,
                activeRides: activeRides.rows[0].count,
                socketConnections
            },
            performance: {
                avgResponseTime: Math.round(avgResponseMs),
                errorRate: 0,
                throughput: totalRequests,
                availability: 99.9
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch metrics" });
    }
});

app.get("/api/admin/stats", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const driversRes = await query("SELECT COUNT(*) as count FROM drivers");
        const ridesRes = await query("SELECT COUNT(*) as count FROM rides");
        // Revenue for the platform should come from system_revenue_ledger (commission/fees), not from gross fares.
        const revenueRes = await query("SELECT COALESCE(SUM(amount), 0) as total FROM system_revenue_ledger WHERE revenue_type IN ('commission','fee')");
        const activeUsersRes = await query("SELECT COUNT(DISTINCT rider_id) as count FROM rides WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)");
        
        // Real ride distribution by service type
        const ridesByTypeRes = await query("SELECT service_type, COUNT(*) as count FROM rides GROUP BY service_type");
        const ridesByType = (ridesByTypeRes.rows || []).map((r: any) => ({
            name: r.service_type || 'eco',
            value: parseInt(r.count),
            color: r.service_type === 'eco' ? '#3b82f6' : r.service_type === 'plus' ? '#8b5cf6' : '#f59e0b'
        }));

        // Real hourly data from last 24 hours (PostgreSQL + MySQL compatible)
        const hourlyRes = await query(
            db.provider === 'postgres'
                ? `SELECT to_char(created_at, 'HH24:00') as time, COUNT(*) as rides, COALESCE(SUM(fare), 0) as revenue FROM rides WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY to_char(created_at, 'HH24:00') ORDER BY time`
                : `SELECT DATE_FORMAT(created_at, '%H:00') as time, COUNT(*) as rides, COALESCE(SUM(fare), 0) as revenue FROM rides WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) GROUP BY HOUR(created_at) ORDER BY time`
        );
        
        const mixedData = (hourlyRes.rows || []).length > 0 ? (hourlyRes.rows || []).map((r: any) => ({
            time: r.time,
            rides: parseInt(r.rides),
            revenue: parseFloat(r.revenue)
        })) : [
            { time: '00:00', rides: 0, revenue: 0 },
            { time: '06:00', rides: 0, revenue: 0 },
            { time: '12:00', rides: 0, revenue: 0 },
            { time: '18:00', rides: 0, revenue: 0 }
        ];

        // Calculate real CSAT from ratings
        const csatRes = await query("SELECT AVG(rider_rating) as avg FROM rides WHERE rider_rating IS NOT NULL");
        const csat = csatRes.rows[0]?.avg ? parseFloat(csatRes.rows[0].avg) : 4.8;

        // Surge zones (real) if the table exists and has data; otherwise 0.
        let surgeZones: any[] = [];
        try {
            const surgeRes = await query("SELECT id, name, multiplier, active, city FROM surge_zones WHERE active = true LIMIT 20");
            surgeZones = surgeRes.rows || [];
        } catch {}

        res.json({
            totalDrivers: parseInt(driversRes.rows[0].count),
            totalRides: parseInt(ridesRes.rows[0].count),
            totalRevenue: parseFloat(revenueRes.rows[0].total || 0),
            activeUsers: parseInt(activeUsersRes.rows[0].count),
            surgeZones: surgeZones,
            ridesByType: ridesByType.length > 0 ? ridesByType : [
                { name: 'City Taxi', value: 400, color: '#3b82f6' },
                { name: 'Plus', value: 300, color: '#8b5cf6' },
                { name: 'Lux', value: 100, color: '#f59e0b' }
            ],
            mixedData,
            csat: parseFloat(csat.toFixed(1)),
            onTime: 92,
            criticalReports: 2
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Stats error" });
    }
});

// Admin Revenue Summary (platform revenue, not gross fares)
app.get("/api/admin/revenue/summary", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const range = (req.query.range || '30d').toString();
        const since =
            range === '24h' ? "DATE_SUB(NOW(), INTERVAL 24 HOUR)" :
            range === '7d' ? "DATE_SUB(NOW(), INTERVAL 7 DAY)" :
            range === '30d' ? "DATE_SUB(NOW(), INTERVAL 30 DAY)" :
            range === '90d' ? "DATE_SUB(NOW(), INTERVAL 90 DAY)" :
            "DATE_SUB(NOW(), INTERVAL 30 DAY)";

        const totals = await query(
            `SELECT 
                COALESCE(SUM(CASE WHEN revenue_type='commission' THEN amount ELSE 0 END), 0) as commission,
                COALESCE(SUM(CASE WHEN revenue_type='fee' THEN amount ELSE 0 END), 0) as fees,
                COALESCE(SUM(amount), 0) as total
             FROM system_revenue_ledger
             WHERE created_at >= ${since}`,
            []
        );

        const daily = await query(
            `SELECT 
                DATE_FORMAT(created_at, '%Y-%m-%d') as day,
                COALESCE(SUM(amount), 0) as total
             FROM system_revenue_ledger
             WHERE created_at >= ${since}
             GROUP BY day
             ORDER BY day ASC`,
            []
        );

        res.json({
            range,
            totals: {
                commission: Number.parseFloat(totals.rows[0]?.commission || '0') || 0,
                fees: Number.parseFloat(totals.rows[0]?.fees || '0') || 0,
                total: Number.parseFloat(totals.rows[0]?.total || '0') || 0
            },
            daily: (daily.rows || []).map((r: any) => ({ day: r.day, total: Number.parseFloat(r.total || '0') || 0 }))
        });
    } catch (e: any) {
        res.status(500).json({ error: e?.message || "Failed to fetch revenue summary" });
    }
});

// Admin: driver credit balances (fast list for dashboards)
app.get("/api/admin/driver-credit/balances", authenticateToken, requireRole(['admin']), async (_req, res) => {
    try {
        const result = await query(
            `SELECT a.driver_id, a.balance, u.name, u.phone
             FROM driver_credit_accounts a
             JOIN users u ON u.id = a.driver_id
             WHERE u.role = 'driver'
             ORDER BY a.balance DESC
             LIMIT 1000`,
            []
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch credit balances" });
    }
});

// NOTE: routing endpoint is defined once near the top of this file.

// Manual ride acceptance endpoint for testing
app.post("/api/rides/:id/accept", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { driverId } = req.body;
    const authUser = getAuthUser(req);
    if (!authUser) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    if (authUser.role !== 'admin' && authUser.role !== 'driver') {
        return res.status(403).json({ error: "Forbidden" });
    }
    
    try {
        // Find an available driver if none specified
        let targetDriverId = driverId;
        if (authUser.role !== 'admin') {
            targetDriverId = authUser.id;
        }
        if (!targetDriverId) {
            const availableDriver = await query(`
                SELECT d.id FROM drivers d 
                JOIN users u ON d.id = u.id 
                WHERE d.status = 'available' 
                AND d.is_active = 1
                LIMIT 1
            `);
            
            if (availableDriver.rows.length > 0) {
                targetDriverId = availableDriver.rows[0].id;
            } else {
                return res.status(404).json({ error: 'No available drivers found' });
            }
        }
        
        // Check if ride exists and is searching
        const rideCheck = await query("SELECT status, rider_id FROM rides WHERE id = ?", [id]);
        if (rideCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Ride not found' });
        }
        
        if (rideCheck.rows[0].status !== 'searching') {
            return res.status(400).json({ error: 'Ride is not available for acceptance' });
        }
        
        // Accept the ride
        await query("UPDATE rides SET status = 'accepted', driver_id = ?, updated_at = NOW() WHERE id = ?", [targetDriverId, id]);
        await query("UPDATE drivers SET status = 'busy' WHERE id = ?", [targetDriverId]);
        
        const riderId = rideCheck.rows[0].rider_id;
        
        // Notify rider via socket
        io.to(riderId).emit("ride_accepted", { 
            rideId: id, 
            driverId: targetDriverId
        });
        
        log.info('Ride manually accepted', { rideId: id, driverId: targetDriverId });
        res.json({ 
            success: true, 
            rideId: id, 
            driverId: targetDriverId,
            message: 'Ride accepted successfully'
        });
        
    } catch (err) {
        log.error('Manual ride acceptance error', err);
        res.status(500).json({ error: 'Failed to accept ride' });
    }
});

// Address Search (Nominatim - OpenStreetMap)
app.get("/api/search", async (req, res) => {
    const { q, lat, lng } = req.query;
    
    try {
        // Use Nominatim for geocoding (free, no API key needed)
        const baseUrl = "https://nominatim.openstreetmap.org/search";
        const params = new URLSearchParams({
            q: q as string,
            format: 'json',
            limit: '10',
            addressdetails: '1',
            // This product targets Afghanistan; keep results relevant by default.
            countrycodes: 'af',
            ...(lat && lng ? { lat: lat as string, lon: lng as string } : {})
        });
        
        const response = await fetch(`${baseUrl}?${params}`, {
            headers: {
                'User-Agent': 'iTaxi-Afghanistan/1.0'
            }
        });
        const data = await response.json();
        
        // Format results
        const results = data.map((item: any) => ({
            name: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            address: item.display_name
        }));
        
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Search failed" });
    }
});


// --- Socket.io Logic ---

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  const rawToken =
      (socket.handshake.auth && (socket.handshake.auth as any).token) ||
      ((socket.handshake.headers.authorization || '') as string).replace(/^Bearer\s+/i, '');
  let socketUser: any = null;
  if (rawToken) {
      try {
          socketUser = jwt.verify(rawToken, JWT_SECRET);
      } catch {
          socketUser = null;
      }
  }
  (socket.data as any).user = socketUser;

  // Role-based rooms (used for live ops / monitoring).
  try {
      if (socketUser?.role === 'admin') {
          socket.join('admins');
      }
      if (socketUser?.role === 'driver' && socketUser?.id) {
          socket.join(socketUser.id);
          socket.join('drivers');
      }
      if (socketUser?.role === 'rider' && socketUser?.id) {
          socket.join(socketUser.id);
      }
  } catch {}

  socket.on("join_room", (userId) => {
    socket.join(userId);
    console.log(`User ${socket.id} joined room ${userId}`);
  });

  socket.on("request_ride", async (data) => {
     // Handled via API
  });

  socket.on("accept_ride", async (data) => {
    const { rideId, driverId } = data;
    const user = (socket.data as any).user;
    if (!user || (user.role !== 'admin' && user.id !== driverId)) {
        socket.emit('ride_accept_failed', { rideId, reason: 'Unauthorized' });
        return;
    }
    try {
        // Check if ride is still available
        const rideCheck = await query("SELECT status, rider_id, driver_id FROM rides WHERE id = ?", [rideId]);
        if (rideCheck.rows.length === 0 || !['searching', 'requested'].includes(rideCheck.rows[0].status)) {
            socket.emit('ride_accept_failed', { rideId, reason: 'Ride no longer available' });
            return;
        }
        const rideRow = rideCheck.rows[0];
        const assignedDriverId = (rideRow.driver_id || '').toString().trim();
        if (assignedDriverId && assignedDriverId !== driverId) {
            socket.emit('ride_accept_failed', { rideId, reason: 'Ride assigned to another driver' });
            return;
        }

        // Enforce KYC/eligibility for non-admin driver acceptance (Req #9).
        if (user.role !== 'admin') {
            const dRes = await query("SELECT status, is_active, kyc_status FROM drivers WHERE id = ? LIMIT 1", [driverId]);
            const d: any = dRes.rows?.[0];
            const isActive = d?.is_active === 1 || d?.is_active === true || d?.is_active === '1';
            if (!d || !isActive) {
                socket.emit('ride_accept_failed', { rideId, reason: 'Driver inactive' });
                return;
            }
            if (d.kyc_status !== 'approved') {
                socket.emit('ride_accept_failed', { rideId, reason: 'KYC not approved' });
                return;
            }
            if (d.status !== 'available') {
                socket.emit('ride_accept_failed', { rideId, reason: 'Driver not available' });
                return;
            }
        }

        // Credit sufficiency check (avoid accepting if driver cannot cover commission+fee).
        try {
            const fareRes = await query("SELECT fare FROM rides WHERE id = ?", [rideId]);
            const fare = Number.parseFloat(fareRes.rows[0]?.fare || '0') || 0;
            let commissionRate = 20;
            let fixedFee = 0;
            try {
                const settingsRes = await query("SELECT settings FROM admin_settings WHERE id = 1");
                if (settingsRes.rows.length > 0) {
                    const settings = JSON.parse(settingsRes.rows[0].settings);
                    commissionRate = settings.pricing?.commissionRate || commissionRate;
                    fixedFee = settings.pricing?.driverCreditFeeFixed || 0;
                }
            } catch {}
            const required = (fare * (commissionRate / 100)) + fixedFee;
            if (required > 0) {
                const bal = await getDriverCreditBalance(driverId);
                if (bal < required) {
                    socket.emit('ride_accept_failed', { rideId, reason: 'Insufficient credit' });
                    return;
                }
            }
        } catch {}
        
        // Update ride and driver status
        const upd = await query(
            "UPDATE rides SET status = 'accepted', driver_id = ?, updated_at = NOW() WHERE id = ? AND status IN ('searching','requested') AND (driver_id IS NULL OR driver_id = '' OR driver_id = ?)",
            [driverId, rideId, driverId]
        );
        const affected = (upd.rows?.[0] as any)?.affectedRows ?? 0;
        if (affected === 0) {
            socket.emit('ride_accept_failed', { rideId, reason: 'Ride no longer available' });
            return;
        }
        await query("UPDATE drivers SET status = 'busy' WHERE id = ?", [driverId]);
        
        const riderId = rideRow.rider_id;
        
        // Get driver info for rider
        const driverInfo = await query(`
            SELECT u.name, u.phone, u.rating, d.vehicle_model, d.vehicle_plate, d.current_lat, d.current_lng
            FROM users u 
            JOIN drivers d ON u.id = d.id 
            WHERE u.id = ?
        `, [driverId]);
        
        const driver = driverInfo.rows[0];
        
        // Notify rider
        io.to(riderId).emit("ride_accepted", { 
            rideId, 
            driverId,
            driver: {
                name: driver.name,
                phone: driver.phone,
                rating: driver.rating,
                vehicle: driver.vehicle_model,
                licensePlate: driver.vehicle_plate,
                location: {
                    lat: driver.current_lat,
                    lng: driver.current_lng
                }
            },
            estimatedArrival: '3-5 min'
        });
        
        // Notify driver of successful acceptance
        socket.emit('ride_accepted_success', { rideId });
        
        // Notify other drivers that ride is taken
        socket.broadcast.emit('ride_taken', { rideId });
        
        console.log(`✅ Ride ${rideId} accepted by driver ${driverId}`);
        
    } catch (e) {
        log.error("Socket accept error", e);
        socket.emit('ride_accept_failed', { rideId, reason: 'Server error' });
    }
  });

  socket.on("update_location", async (data) => {
    const { driverId, location, rideId } = data;
    const user = (socket.data as any).user;
    if (!user || (user.role !== 'admin' && user.id !== driverId)) {
        return;
    }
    
    if (rideId) {
        const res = await query("SELECT rider_id FROM rides WHERE id = ?", [rideId]);
        if (res.rows.length > 0) {
            io.to(res.rows[0].rider_id).emit("driver_location_update", { driverId, location });
        }
    }

    // Always publish to admins for live ops map/monitoring.
    io.to('admins').emit("driver_location_update", { driverId, location });
    
    await query("UPDATE drivers SET current_lat = ?, current_lng = ?, last_updated = NOW() WHERE id = ?", [location.lat, location.lng, driverId]);
  });

  socket.on("send_message", async (data) => {
    // data: { recipientId, text, senderId, rideId }
    const user = (socket.data as any).user;
    if (!user || (user.role !== 'admin' && user.id !== data.senderId)) {
        return;
    }
    io.to(data.recipientId).emit("new_message", data);
    
    // Persist to DB
    await query(
        "INSERT INTO chat_messages (id, ride_id, sender_id, recipient_id, message, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
        [generateId(), data.rideId, data.senderId, data.recipientId, data.text]
    );
  });

  socket.on("disconnect", () => {
    metricsService.incrementCounter('websocket_disconnections');
    log.info("User disconnected:", socket.id);

    // If a driver disconnects, mark them offline to keep admin live ops accurate.
    // (If a ride is in-progress, the ride status remains the source of truth.)
    const u = (socket.data as any).user;
    if (u?.role === 'driver' && u?.id) {
        query("UPDATE drivers SET status = 'offline', last_updated = NOW() WHERE id = ?", [u.id]).catch(() => {});
        io.to('admins').emit('driver_status_update', { driverId: u.id, status: 'offline' });
    }
  });
});

// Update metrics periodically
setInterval(async () => {
    try {
        const activeRides = await query("SELECT COUNT(*) as count FROM rides WHERE status IN ('searching', 'accepted', 'in_progress')");
        const availableDrivers = await query("SELECT COUNT(*) as count FROM drivers WHERE status = 'available'");
        
        metricsService.setGauge('active_rides_total', activeRides.rows[0].count);
        metricsService.setGauge('available_drivers_total', availableDrivers.rows[0].count);
    } catch (e) {
        log.error('Metrics update error', e);
    }
}, 10000);

async function startServer() {
  if (NODE_ENV !== "production") {
    // In development, let Vite handle the frontend
    console.log(`[dev] Frontend served by Vite on port 5173`);
    console.log(`[dev] API server running on port ${PORT}`);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      if (req.path.startsWith("/api/") || req.path.startsWith("/socket.io/")) return next();
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    log.info(`iTaxi Server running on http://localhost:${PORT}`);
    log.info(`Environment: ${NODE_ENV}`);
    if (db.provider === 'postgres') {
        const url = String(process.env.DATABASE_URL || '').trim();
        if (url) {
            // Mask credentials in logs: postgres://user:pass@host -> postgres://****@host
            let masked = url;
            try {
                const u = new URL(url);
                if (u.username || u.password) {
                    u.username = '****';
                    u.password = '';
                    masked = u.toString();
                }
            } catch {
                // ignore parse errors; log raw URL (may not include credentials)
            }
            log.info(`Database: ${masked}`);
        } else {
            log.info(`Database: postgres://${process.env.POSTGRES_HOST || process.env.PGHOST || 'localhost'}:${process.env.POSTGRES_PORT || process.env.PGPORT || '5432'}/${process.env.POSTGRES_DATABASE || process.env.PGDATABASE || 'itaxi'}`);
        }
    } else {
        log.info(
            `Database: mysql://${process.env.MYSQL_HOST || process.env.MYSQLHOST || 'localhost'}:${process.env.MYSQL_PORT || process.env.MYSQLPORT || '3306'}/${process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || 'itaxi'}`
        );
    }
  });
}

// Background Check / KYC Routes
const kycUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => {
            const dir = path.join(uploadsDir, "kyc");
            try {
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            } catch {}
            cb(null, dir);
        },
        filename: (_req, file, cb) => {
            const safeOriginal = (file.originalname || "document")
                .replace(/[^\w.\-]+/g, "_")
                .slice(0, 80);
            const ext = path.extname(safeOriginal) || "";
            const base = safeOriginal.replace(new RegExp(`${ext}$`), "");
            cb(null, `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${base}${ext}`);
        }
    }),
    limits: { fileSize: 12 * 1024 * 1024 } // 12MB per doc
});

app.post(
    "/api/background-check/submit",
    authenticateToken,
    requireRole(['driver', 'admin']),
    kycUpload.fields([
        { name: "nationalId", maxCount: 1 },
        { name: "drivingLicense", maxCount: 1 },
        { name: "criminalRecord", maxCount: 1 }
    ]),
    async (req, res) => {
        try {
            const authUser = getAuthUser(req);
            if (!authUser) return res.status(401).json({ error: "Unauthorized" });
            const driverId = authUser.id;

            const files = (req as any).files as Record<string, Express.Multer.File[]> | undefined;
            const nationalIdUrl = files?.nationalId?.[0]?.filename ? `/uploads/kyc/${files.nationalId[0].filename}` : undefined;
            const drivingLicenseUrl = files?.drivingLicense?.[0]?.filename ? `/uploads/kyc/${files.drivingLicense[0].filename}` : undefined;
            const criminalRecordUrl = files?.criminalRecord?.[0]?.filename ? `/uploads/kyc/${files.criminalRecord[0].filename}` : undefined;

            const payload = {
                nationalId: nationalIdUrl || req.body?.nationalId || '',
                drivingLicense: drivingLicenseUrl || req.body?.drivingLicense || '',
                criminalRecord: criminalRecordUrl || req.body?.criminalRecord || ''
            };

            if (!payload.nationalId || !payload.drivingLicense || !payload.criminalRecord) {
                return res.status(400).json({ error: "Missing required documents" });
            }

            // Mark driver KYC pending
            try {
                await query("UPDATE drivers SET kyc_status = 'pending', kyc_updated_at = NOW() WHERE id = ?", [driverId]);
            } catch {}

            const result = await BackgroundCheckService.submit(driverId, payload);
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: "Failed to submit" });
        }
    }
);

app.post("/api/background-check/review", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { checkId, status, reason, driverLevel } = req.body;
        await BackgroundCheckService.review(checkId, (req as any).user.id, status, reason);
        // Keep driver KYC status/level in sync.
        try {
            const bc = await query("SELECT driver_id FROM background_checks WHERE id = ? LIMIT 1", [checkId]);
            const driverId = bc.rows[0]?.driver_id;
            if (driverId) {
                const kycStatus = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';
                await query("UPDATE drivers SET kyc_status = ?, kyc_updated_at = NOW() WHERE id = ?", [kycStatus, driverId]);
                if (driverLevel && typeof driverLevel === 'string') {
                    await query("UPDATE drivers SET driver_level = ? WHERE id = ?", [driverLevel, driverId]);
                }
            }
        } catch {}
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to review" });
    }
});

app.put("/api/admin/drivers/:id/level", authenticateToken, requireRole(['admin']), async (req, res) => {
    const driverId = firstParam((req.params as any).id);
    const { driverLevel } = req.body || {};
    if (!driverLevel || typeof driverLevel !== 'string') {
        return res.status(400).json({ error: "Missing driverLevel" });
    }
    try {
        await query("UPDATE drivers SET driver_level = ? WHERE id = ?", [driverLevel, driverId]);
        res.json({ status: "updated" });
    } catch (e) {
        res.status(500).json({ error: "Failed to update driver level" });
    }
});

app.get("/api/background-check/pending", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const checks = await BackgroundCheckService.getPending();
        res.json(checks);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch" });
    }
});

// Instant Payout
app.post("/api/payout/instant", authenticateToken, async (req, res) => {
    try {
        const driverId = (req as any).user.id;
        const { amount } = req.body;
        const result = await InstantPayoutService.request(driverId, amount);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "Payout failed" });
    }
});

// A/B Testing
app.post("/api/ab/experiment", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { name, variants } = req.body;
        const id = await ABTestingService.createExperiment(name, variants);
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

app.get("/api/ab/variant/:experimentId", authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const variant = await ABTestingService.assignVariant(firstParam(req.params.experimentId), userId);
        res.json({ variant });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

app.post("/api/ab/track", authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const { experimentId, eventName, value } = req.body;
        await ABTestingService.trackEvent(experimentId, userId, eventName, value);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// Package Delivery
app.post("/api/package/create", authenticateToken, async (req, res) => {
    try {
        const senderId = (req as any).user.id;
        const result = await PackageDeliveryService.create({ ...req.body, senderId });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

app.post("/api/package/:id/assign", authenticateToken, async (req, res) => {
    try {
        const { driverId } = req.body;
        await PackageDeliveryService.assign(firstParam(req.params.id), driverId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

app.put("/api/package/:id/status", authenticateToken, async (req, res) => {
    try {
        const { status, proofPhoto } = req.body;
        await PackageDeliveryService.updateStatus(firstParam(req.params.id), status, proofPhoto);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// Trip Recording
app.post("/api/recording/start", authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const { rideId } = req.body;
        const result = await TripRecordingService.start(rideId, userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

app.post("/api/recording/:id/stop", authenticateToken, async (req, res) => {
    try {
        await TripRecordingService.stop(firstParam(req.params.id));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// Encryption
app.post("/api/encryption/setup", authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const { publicKey } = req.body;
        await EncryptionService.storePublicKey(userId, publicKey);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

app.get("/api/encryption/key/:userId", authenticateToken, async (req, res) => {
    try {
        const publicKey = await EncryptionService.getPublicKey(firstParam(req.params.userId));
        res.json({ publicKey });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// Heat Map
app.get("/api/heatmap/demand", authenticateToken, async (req, res) => {
    try {
        const data = await HeatMapService.getDemandHeatMap();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

app.get("/api/heatmap/earnings", authenticateToken, async (req, res) => {
    try {
        const data = await HeatMapService.getEarningsHeatMap();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

app.get("/api/heatmap/hotzones", authenticateToken, async (req, res) => {
    try {
        const zones = await HeatMapService.getHotZones();
        res.json(zones);
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// Ride Sharing
app.post("/api/rides/pool/find", authenticateToken, async (req, res) => {
    try {
        const matches = await RideSharingService.findMatchingRides(req.body);
        res.json({ matches });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

app.post("/api/rides/pool/create", authenticateToken, async (req, res) => {
    try {
        const { rideIds, driverId } = req.body;
        const poolId = await RideSharingService.createPoolRide(rideIds, driverId);
        res.json({ poolId });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// Multi-Stop
app.post("/api/rides/multistop", authenticateToken, async (req, res) => {
    try {
        const riderId = (req as any).user.id;
        const { stops, serviceType } = req.body;
        const rideId = await MultiStopService.createMultiStopRide(riderId, stops, serviceType);
        res.json({ rideId });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

app.get("/api/rides/:id/stops", authenticateToken, async (req, res) => {
    try {
        const stops = await MultiStopService.getRideStops(firstParam(req.params.id));
        res.json(stops);
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

app.post("/api/rides/:id/stop/:order/complete", authenticateToken, async (req, res) => {
    try {
        await MultiStopService.completeStop(firstParam(req.params.id), Number.parseInt(firstParam(req.params.order), 10));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error" });
});

// Only start the HTTP server when run directly (not when imported by Vercel serverless)
if (process.env.VERCEL !== '1') {
    startServer();
}

export default app;
