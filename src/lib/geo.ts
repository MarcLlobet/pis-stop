import type { LatLng, Stop } from './types';

const EARTH_RADIUS_METERS = 6_371_000;

/** A photo further than this from every stop is shown on its own. */
export const DEFAULT_SNAP_METERS = 150;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance (haversine). */
export const distanceMeters = (from: LatLng, to: LatLng): number => {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const nearestStop = (
  stops: readonly Stop[],
  point: LatLng,
  maxMeters: number = DEFAULT_SNAP_METERS,
): Stop | null =>
  stops
    .map((stop) => ({ stop, distance: distanceMeters(stop.position, point) }))
    .filter(({ distance }) => distance <= maxMeters)
    .reduce<{ readonly stop: Stop; readonly distance: number } | null>(
      (best, candidate) => (best === null || candidate.distance < best.distance ? candidate : best),
      null,
    )?.stop ?? null;

export const centroid = (points: readonly LatLng[]): LatLng | null =>
  points.length === 0
    ? null
    : {
        lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
        lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
      };
