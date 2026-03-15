import { apiFetch } from './api.js';
import type { Location, Poi, PoiCategory } from '../types.js';

export type FetchPoisParams = {
    center: Location;
    radiusM?: number;
    categories?: PoiCategory[];
    limit?: number;
    signal?: AbortSignal;
};

const MEM_CACHE_TTL_MS = 2 * 60 * 1000;
const memCache = new Map<string, { expiresAt: number; data: Poi[] }>();

// Seed POIs: used when external POI providers are unavailable (offline / restricted networks).
// Keep this list small and high-signal; admins can later replace with a real provider.
const SEED_POIS: Poi[] = [
    {
        id: 'seed:kabul_center',
        name: 'Kabul (Center)',
        category: 'landmark',
        location: { lat: 34.5281, lng: 69.1723 },
        address: 'Kabul',
        source: 'manual',
    },
    {
        id: 'seed:kabul_city_center',
        name: 'Kabul City Center',
        category: 'mall',
        location: { lat: 34.5325, lng: 69.1653 },
        address: 'Shahr-e Naw, Kabul',
        source: 'manual',
    },
    {
        id: 'seed:kabul_city_mall',
        name: 'City Mall',
        category: 'mall',
        location: { lat: 34.53332, lng: 69.17197 },
        address: 'Kabul',
        source: 'manual',
    },
    {
        id: 'seed:kabul_serena_hotel',
        name: 'Kabul Serena Hotel',
        category: 'hotel',
        location: { lat: 34.520062, lng: 69.178986 },
        address: 'Kabul',
        source: 'manual',
    },
    {
        id: 'seed:kabul_airport',
        name: 'Hamid Karzai International Airport',
        category: 'airport',
        location: { lat: 34.565556, lng: 69.210556 },
        address: 'Kabul',
        source: 'manual',
    },
    {
        id: 'seed:jalalabad_center',
        name: 'Jalalabad (Center)',
        category: 'landmark',
        location: { lat: 34.4265, lng: 70.4515 },
        address: 'Jalalabad',
        source: 'manual',
    },
    {
        id: 'seed:herat_airport',
        name: 'Herat International Airport',
        category: 'airport',
        location: { lat: 34.21056, lng: 62.22833 },
        address: 'Herat',
        source: 'manual',
    },
    {
        id: 'seed:herat_center',
        name: 'Herat (Center)',
        category: 'landmark',
        location: { lat: 34.3482, lng: 62.1997 },
        address: 'Herat',
        source: 'manual',
    },
    {
        id: 'seed:kandahar_airport',
        name: 'Kandahar International Airport',
        category: 'airport',
        location: { lat: 31.50583, lng: 65.84778 },
        address: 'Kandahar',
        source: 'manual',
    },
    {
        id: 'seed:kandahar_center',
        name: 'Kandahar (Center)',
        category: 'landmark',
        location: { lat: 31.6133, lng: 65.7101 },
        address: 'Kandahar',
        source: 'manual',
    },
    {
        id: 'seed:mazar_airport',
        name: 'Mazar-i-Sharif International Airport',
        category: 'airport',
        location: { lat: 36.70694, lng: 67.20972 },
        address: 'Mazar-i-Sharif',
        source: 'manual',
    },
    {
        id: 'seed:mazar_center',
        name: 'Mazar-i-Sharif (Center)',
        category: 'landmark',
        location: { lat: 36.709, lng: 67.1109 },
        address: 'Mazar-i-Sharif',
        source: 'manual',
    },
    {
        id: 'seed:kandahar_ahmadi_market',
        name: 'Ahmadi Market',
        category: 'mall',
        location: { lat: 31.61305, lng: 65.7035 },
        address: 'Kandahar',
        source: 'manual',
    },
    {
        id: 'seed:kunduz_center',
        name: 'Kunduz (Center)',
        category: 'landmark',
        location: { lat: 36.729, lng: 68.857 },
        address: 'Kunduz',
        source: 'manual',
    },
];

const round = (n: number, digits: number) => {
    const m = Math.pow(10, digits);
    return Math.round(n * m) / m;
};

const haversineMeters = (a: Location, b: Location) => {
    const R = 6371000;
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
};

const seedPoisNear = (center: Location, radiusM: number, categories: PoiCategory[], limit: number) => {
    const catSet = new Set(categories);
    return SEED_POIS
        .filter((p) => {
            if (!p?.location) return false;
            if (!catSet.has(p.category) && !catSet.has('poi')) return false;
            return haversineMeters(center, p.location) <= radiusM;
        })
        .slice(0, limit);
};

const makeCacheKey = (params: FetchPoisParams) => {
    const { center, radiusM = 2500, categories = ['hotel', 'airport', 'mall'], limit = 80 } = params;
    const cats = [...categories].sort().join(',');
    // Round to reduce cache fragmentation while panning.
    const lat = round(center.lat, 3);
    const lng = round(center.lng, 3);
    return `pois:${cats}:${lat},${lng}:${Math.round(radiusM)}:${limit}`;
};

export async function fetchPois(params: FetchPoisParams): Promise<Poi[]> {
    const radiusM = Math.max(200, Math.min(10_000, Math.round(params.radiusM ?? 2500)));
    const limit = Math.max(1, Math.min(150, Math.round(params.limit ?? 80)));
    const categories: PoiCategory[] = (params.categories && params.categories.length)
        ? params.categories
        : ['hotel', 'airport', 'mall'];

    const key = makeCacheKey({ ...params, radiusM, limit, categories });
    const cached = memCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    try {
        const qs = new URLSearchParams({
            lat: String(params.center.lat),
            lng: String(params.center.lng),
            radiusM: String(radiusM),
            limit: String(limit),
            categories: categories.join(','),
        });

        const res = await apiFetch(`/api/pois?${qs.toString()}`, {
            method: 'GET',
            signal: params.signal,
        });

        if (!res.ok) {
            // Backwards compatibility: older server builds won't have /api/pois yet.
            if (res.status === 404) {
                const direct = await fetchPoisFromOverpassDirect({ ...params, radiusM, limit, categories });
                const final = direct.length > 0 ? direct : seedPoisNear(params.center, radiusM, categories, limit);
                memCache.set(key, { expiresAt: Date.now() + MEM_CACHE_TTL_MS, data: final });
                return final;
            }
            const final = seedPoisNear(params.center, radiusM, categories, limit);
            memCache.set(key, { expiresAt: Date.now() + MEM_CACHE_TTL_MS, data: final });
            return final;
        }
        const json = await res.json().catch(() => null);
        const pois: Poi[] = Array.isArray(json?.pois) ? json.pois : [];

        const final = pois.length > 0 ? pois : seedPoisNear(params.center, radiusM, categories, limit);

        memCache.set(key, { expiresAt: Date.now() + MEM_CACHE_TTL_MS, data: final });
        return final;
    } catch (e) {
        // Network errors should never break rider map interactions.
        // As a fallback, try direct Overpass from the browser (if allowed by CORS).
        const direct = await fetchPoisFromOverpassDirect({ ...params, radiusM, limit, categories }).catch(() => []);
        return direct.length > 0 ? direct : seedPoisNear(params.center, radiusM, categories, limit);
    }
}

function normalizePoiCategoryFromTags(tags: any): PoiCategory {
    if (!tags || typeof tags !== 'object') return 'poi';

    const tourism = String(tags.tourism || '').toLowerCase();
    if (tourism === 'hotel' || tourism === 'hostel' || tourism === 'guest_house' || tourism === 'motel') return 'hotel';

    const aeroway = String(tags.aeroway || '').toLowerCase();
    if (aeroway === 'aerodrome' || aeroway === 'airport' || aeroway === 'terminal') return 'airport';

    const shop = String(tags.shop || '').toLowerCase();
    const amenity = String(tags.amenity || '').toLowerCase();
    if (shop === 'mall' || amenity === 'shopping_mall' || amenity === 'marketplace') return 'mall';

    if (amenity === 'restaurant' || amenity === 'cafe' || amenity === 'fast_food') return 'restaurant';
    if (amenity === 'hospital' || amenity === 'clinic' || amenity === 'doctors' || amenity === 'pharmacy') return 'hospital';
    if (amenity === 'fuel') return 'fuel';

    if (typeof tags.historic === 'string' && tags.historic) return 'landmark';

    return 'poi';
}

function buildOverpassQuery(center: Location, radiusM: number, categories: PoiCategory[]) {
    const want = new Set(categories);
    const around = `around:${radiusM},${center.lat},${center.lng}`;

    const blocks: string[] = [];
    if (want.has('hotel')) {
        blocks.push(`node(${around})["tourism"="hotel"];`);
        blocks.push(`way(${around})["tourism"="hotel"];`);
        blocks.push(`relation(${around})["tourism"="hotel"];`);
        blocks.push(`node(${around})["tourism"="guest_house"];`);
        blocks.push(`node(${around})["tourism"="hostel"];`);
    }

    if (want.has('airport')) {
        blocks.push(`node(${around})["aeroway"="aerodrome"];`);
        blocks.push(`way(${around})["aeroway"="aerodrome"];`);
        blocks.push(`relation(${around})["aeroway"="aerodrome"];`);
        blocks.push(`node(${around})["aeroway"="terminal"];`);
        blocks.push(`way(${around})["aeroway"="terminal"];`);
    }

    if (want.has('mall') || want.has('shopping')) {
        blocks.push(`node(${around})["shop"="mall"];`);
        blocks.push(`way(${around})["shop"="mall"];`);
        blocks.push(`relation(${around})["shop"="mall"];`);
        blocks.push(`node(${around})["amenity"="shopping_mall"];`);
        blocks.push(`way(${around})["amenity"="shopping_mall"];`);
        blocks.push(`relation(${around})["amenity"="shopping_mall"];`);
        blocks.push(`node(${around})["amenity"="marketplace"];`);
    }

    if (want.has('restaurant')) {
        blocks.push(`node(${around})["amenity"~"^(restaurant|cafe|fast_food)$"];`);
    }

    if (want.has('hospital')) {
        blocks.push(`node(${around})["amenity"~"^(hospital|clinic|doctors|pharmacy)$"];`);
    }

    if (want.has('fuel')) {
        blocks.push(`node(${around})["amenity"="fuel"];`);
    }

    if (want.has('landmark') || want.has('poi')) {
        blocks.push(`node(${around})["tourism"="attraction"];`);
        blocks.push(`node(${around})["historic"];`);
    }

    return `
[out:json][timeout:18];
(
${blocks.join('\n')}
);
out center qt;
`.trim();
}

async function fetchPoisFromOverpassDirect(params: FetchPoisParams): Promise<Poi[]> {
    const radiusM = Math.max(200, Math.min(10_000, Math.round(params.radiusM ?? 2500)));
    const limit = Math.max(1, Math.min(150, Math.round(params.limit ?? 80)));
    const categories: PoiCategory[] = (params.categories && params.categories.length)
        ? params.categories
        : ['hotel', 'airport', 'mall'];

    const key = `overpass-direct:${round(params.center.lat, 3)},${round(params.center.lng, 3)}:${radiusM}:${limit}:${[...categories].sort().join(',')}`;
    const cached = memCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const query = buildOverpassQuery(params.center, radiusM, categories);
    const body = new URLSearchParams({ data: query }).toString();

    const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass.openstreetmap.ru/api/interpreter',
    ];

    let json: any = null;
    for (const endpoint of endpoints) {
        try {
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
                    'Accept': 'application/json',
                },
                body,
                signal: params.signal,
            });

            if (!resp.ok) continue;
            json = await resp.json().catch(() => null);
            if (json) break;
        } catch {
            // try next endpoint
        }
    }

    if (!json) return [];
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

        const category = normalizePoiCategoryFromTags(tags);
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

    memCache.set(key, { expiresAt: Date.now() + MEM_CACHE_TTL_MS, data: pois });
    return pois;
}
