import { RouteData, Location } from '../types';

const API_URL = (import.meta as any).env?.VITE_ROUTING_API_URL || '/api/routing';

interface DirectionsResponse {
  geometry: any;
  distance: number;
  duration: number;
}

interface MatrixResponse {
  distances: number[][];
  durations: number[][];
}

export const getDirections = async (start: Location, end: Location): Promise<RouteData> => {
  const response = await fetch(`${API_URL}/directions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start, end })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get directions');
  }

  const data: DirectionsResponse = await response.json();
  
  // Decode polyline geometry to coordinates
  const coordinates = decodePolyline(data.geometry);
  
  return {
    coordinates,
    distance: data.distance,
    duration: data.duration,
    bbox: calculateBbox(coordinates)
  };
};

export const getMatrix = async (locations: Location[]): Promise<MatrixResponse> => {
  const response = await fetch(`${API_URL}/matrix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get matrix');
  }

  return response.json();
};

// Decode polyline from OpenRouteService
const decodePolyline = (encoded: string): [number, number][] => {
  const coords: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    coords.push([lat / 1e5, lng / 1e5]);
  }

  return coords;
};

const calculateBbox = (coords: [number, number][]): [number, number, number, number] => {
  const lats = coords.map(c => c[0]);
  const lngs = coords.map(c => c[1]);
  return [
    Math.min(...lats),
    Math.min(...lngs),
    Math.max(...lats),
    Math.max(...lngs)
  ];
};
