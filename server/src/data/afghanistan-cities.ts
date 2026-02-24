// Afghanistan Cities Data - All 34 Provinces
// Used for rider/driver location filtering and dispatch

export interface AfghanistanCity {
  id: string;
  name: string;
  lat: number;
  lng: number;
  province: string;
  region?: string;
}

export const AFGHANISTAN_CITIES: AfghanistanCity[] = [
  // Kabul Province (Capital)
  { id: 'kabul', name: 'Kabul', lat: 34.5553, lng: 69.2075, province: 'Kabul', region: 'Central' },

  // Herat Province (Western)
  { id: 'herat', name: 'Herat', lat: 34.3425, lng: 62.2000, province: 'Herat', region: 'Western' },

  // Kandahar Province (Southern)
  { id: 'kandahar', name: 'Kandahar', lat: 31.6257, lng: 65.7245, province: 'Kandahar', region: 'Southern' },

  // Balkh Province (Northern)
  { id: 'mazar', name: 'Mazar-i-Sharif', lat: 36.7538, lng: 67.1104, province: 'Balkh', region: 'Northern' },

  // Nangarhar Province (Eastern)
  { id: 'jalalabad', name: 'Jalalabad', lat: 34.4261, lng: 70.4512, province: 'Nangarhar', region: 'Eastern' },

  // Kunduz Province (Northern)
  { id: 'kunduz', name: 'Kunduz', lat: 36.7304, lng: 68.8656, province: 'Kunduz', region: 'Northern' },

  // Ghazni Province (Central)
  { id: 'ghazni', name: 'Ghazni', lat: 33.5505, lng: 68.4336, province: 'Ghazni', region: 'Central' },

  // Khost Province (Eastern)
  { id: 'khost', name: 'Khost', lat: 33.3398, lng: 69.9075, province: 'Khost', region: 'Eastern' },

  // Paktia Province (Eastern)
  { id: 'gardez', name: 'Gardez', lat: 33.5939, lng: 69.2075, province: 'Paktia', region: 'Eastern' },

  // Logar Province (Central)
  { id: 'pul_alam', name: 'Pul-i-Alam', lat: 34.0167, lng: 69.2833, province: 'Logar', region: 'Central' },

  // Wardak Province (Central)
  { id: 'maidan_shahr', name: 'Maidan Shahr', lat: 34.5333, lng: 68.5333, province: 'Wardak', region: 'Central' },

  // Panjshir Province (Central)
  { id: 'bazarak', name: 'Bazarak', lat: 35.3167, lng: 69.5167, province: 'Panjshir', region: 'Central' },

  // Takhar Province (Northern)
  { id: 'taluqan', name: 'Taluqan', lat: 36.7333, lng: 69.5333, province: 'Takhar', region: 'Northern' },

  // Badakhshan Province (Northeastern)
  { id: 'faizabad', name: 'Faizabad', lat: 37.1200, lng: 71.5500, province: 'Badakhshan', region: 'Northeastern' },

  // Baghlan Province (Northern)
  { id: 'baghlan', name: 'Baghlan', lat: 36.1667, lng: 68.6667, province: 'Baghlan', region: 'Northern' },

  // Samangan Province (Northern)
  { id: 'samangan', name: 'Samangan', lat: 36.5333, lng: 67.4833, province: 'Samangan', region: 'Northern' },

  // Sar-e Pul Province (Northern)
  { id: 'sar_e_pul', name: 'Sar-e Pul', lat: 36.2167, lng: 66.5500, province: 'Sar-e Pul', region: 'Northern' },

  // Faryab Province (Northwestern)
  { id: 'maimana', name: 'Maimana', lat: 35.9167, lng: 64.7833, province: 'Faryab', region: 'Northwestern' },

  // Jawzjan Province (Northern)
  { id: 'sheberghan', name: 'Sheberghan', lat: 36.6667, lng: 65.7500, province: 'Jawzjan', region: 'Northern' },

  // Badghis Province (Western)
  { id: 'qala_naw', name: 'Qala Naw', lat: 34.9667, lng: 63.1167, province: 'Badghis', region: 'Western' },

  // Ghor Province (Central)
  { id: 'chaghcharan', name: 'Chaghcharan', lat: 34.5167, lng: 64.3500, province: 'Ghor', region: 'Central' },

  // Daykundi Province (Central)
  { id: 'nili', name: 'Nili', lat: 34.6500, lng: 65.4000, province: 'Daykundi', region: 'Central' },

  // Uruzgan Province (Southern)
  { id: 'tirin_kot', name: 'Tirin Kot', lat: 32.9167, lng: 66.8833, province: 'Uruzgan', region: 'Southern' },

  // Zabul Province (Southern)
  { id: 'qalat', name: 'Qalat', lat: 32.9333, lng: 67.0167, province: 'Zabul', region: 'Southern' },

  // Paktika Province (Southeastern)
  { id: 'sharan', name: 'Sharan', lat: 32.7667, lng: 67.0167, province: 'Paktika', region: 'Southeastern' },

  // Nimruz Province (Southwestern)
  { id: 'zaranj', name: 'Zaranj', lat: 31.1833, lng: 61.8500, province: 'Nimruz', region: 'Southwestern' },

  // Helmand Province (Southern)
  { id: 'lashkar_gah', name: 'Lashkar Gah', lat: 31.9833, lng: 64.3667, province: 'Helmand', region: 'Southern' },

  // Farah Province (Western)
  { id: 'farah', name: 'Farah', lat: 32.3667, lng: 62.3000, province: 'Farah', region: 'Western' },

  // Kapisa Province (Central)
  { id: 'mahmud_raqi', name: 'Mahmud Raqi', lat: 34.9167, lng: 69.5167, province: 'Kapisa', region: 'Central' },

  // Parwan Province (Central)
  { id: 'charikar', name: 'Charikar', lat: 35.2167, lng: 69.1667, province: 'Parwan', region: 'Central' },

  // Bamyan Province (Central)
  { id: 'bamyan', name: 'Bamyan', lat: 34.8167, lng: 67.8333, province: 'Bamyan', region: 'Central' },

  // Laghman Province (Eastern)
  { id: 'mihtarlam', name: 'Mihtarlam', lat: 34.6667, lng: 70.1667, province: 'Laghman', region: 'Eastern' },

  // Kunar Province (Northeastern)
  { id: 'asadabad', name: 'Asadabad', lat: 34.8667, lng: 71.1333, province: 'Kunar', region: 'Northeastern' },

  // Nurestan Province (Northeastern)
  { id: 'parun', name: 'Parun', lat: 35.1667, lng: 71.5833, province: 'Nurestan', region: 'Northeastern' }
];

// Helper functions
export function getCityById(id: string): AfghanistanCity | undefined {
  return AFGHANISTAN_CITIES.find(city => city.id === id);
}

export function getCitiesByProvince(province: string): AfghanistanCity[] {
  return AFGHANISTAN_CITIES.filter(city => city.province === province);
}

export function getCitiesByRegion(region: string): AfghanistanCity[] {
  return AFGHANISTAN_CITIES.filter(city => city.region === region);
}

export function getAllProvinces(): string[] {
  return [...new Set(AFGHANISTAN_CITIES.map(city => city.province))];
}

export function getAllRegions(): string[] {
  const regions = AFGHANISTAN_CITIES
    .map(city => city.region)
    .filter((region): region is string => !!region);
  return [...new Set(regions)];
}

export function getNearestCity(lat: number, lng: number): AfghanistanCity | undefined {
  let nearest: AfghanistanCity | undefined;
  let minDistance = Infinity;

  for (const city of AFGHANISTAN_CITIES) {
    const distance = Math.sqrt(
      Math.pow(city.lat - lat, 2) + Math.pow(city.lng - lng, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearest = city;
    }
  }

  return nearest;
}

export default AFGHANISTAN_CITIES;
