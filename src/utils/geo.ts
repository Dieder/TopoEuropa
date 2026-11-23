import { GeoPlace } from '../types/game';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function pointToSegmentKm(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const cosLat = Math.cos(toRad((aLat + bLat + pLat) / 3));
  const px = (pLng - aLng) * cosLat;
  const py = pLat - aLat;
  const bx = (bLng - aLng) * cosLat;
  const by = bLat - aLat;

  const lenSq = bx * bx + by * by;
  let t = 0;
  if (lenSq > 1e-10) {
    t = Math.max(0, Math.min(1, (px * bx + py * by) / lenSq));
  }
  const closestLat = aLat + t * (bLat - aLat);
  const closestLng = aLng + t * (bLng - aLng);
  return haversineKm(pLat, pLng, closestLat, closestLng);
}

export function distanceToPlaceKm(lat: number, lng: number, place: GeoPlace): number {
  if (place.path && place.path.length >= 2) {
    let minKm = Infinity;
    for (let i = 0; i < place.path.length - 1; i++) {
      const [aLat, aLng] = place.path[i];
      const [bLat, bLng] = place.path[i + 1];
      const d = pointToSegmentKm(lat, lng, aLat, aLng, bLat, bLng);
      if (d < minKm) minKm = d;
    }
    return minKm;
  }
  return haversineKm(lat, lng, place.lat, place.lng);
}

export function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function normalizeAngleDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function lerpAngleDeg(current: number, target: number, factor: number): number {
  const diff = ((((target - current) % 360) + 540) % 360) - 180;
  return current + diff * factor;
}
