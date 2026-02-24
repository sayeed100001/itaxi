const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(lat: number, lng: number, precision: number = 6): string {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const lngMid = (lngMin + lngMax) / 2;
      if (lng > lngMid) {
        idx |= (1 << (4 - bit));
        lngMin = lngMid;
      } else {
        lngMax = lngMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat > latMid) {
        idx |= (1 << (4 - bit));
        latMin = latMid;
      } else {
        latMax = latMid;
      }
    }

    evenBit = !evenBit;

    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

export function getNeighbors(geohash: string): string[] {
  const neighbors: string[] = [geohash];
  
  // Simplified neighbor calculation - returns adjacent cells
  const directions = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  
  for (const dir of directions) {
    const neighbor = getNeighbor(geohash, dir);
    if (neighbor) neighbors.push(neighbor);
  }
  
  return neighbors;
}

function getNeighbor(geohash: string, direction: string): string | null {
  const neighbor: { [key: string]: { [key: string]: string } } = {
    n: { even: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy', odd: 'bc01fg45238967deuvhjyznpkmstqrwx' },
    s: { even: '14365h7k9dcfesgujnmqp0r2twvyx8zb', odd: '238967debc01fg45kmstqrwxuvhjyznp' },
    e: { even: 'bc01fg45238967deuvhjyznpkmstqrwx', odd: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy' },
    w: { even: '238967debc01fg45kmstqrwxuvhjyznp', odd: '14365h7k9dcfesgujnmqp0r2twvyx8zb' },
  };

  const border: { [key: string]: { [key: string]: string } } = {
    n: { even: 'prxz', odd: 'bcfguvyz' },
    s: { even: '028b', odd: '0145hjnp' },
    e: { even: 'bcfguvyz', odd: 'prxz' },
    w: { even: '0145hjnp', odd: '028b' },
  };

  if (!geohash || geohash.length === 0) return null;

  const lastChar = geohash[geohash.length - 1];
  let parent = geohash.slice(0, -1);
  const type = geohash.length % 2 === 0 ? 'even' : 'odd';

  // Handle composite directions
  if (direction.length > 1) {
    const first = getNeighbor(geohash, direction[0]);
    return first ? getNeighbor(first, direction[1]) : null;
  }

  if (border[direction] && border[direction][type].indexOf(lastChar) !== -1 && parent) {
    parent = getNeighbor(parent, direction) || parent;
  }

  const neighborMap = neighbor[direction]?.[type];
  if (!neighborMap) return null;

  return parent + BASE32[neighborMap.indexOf(lastChar)];
}
