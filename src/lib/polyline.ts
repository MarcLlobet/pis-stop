import type { LatLng } from './types';

interface DecodeState {
  readonly values: readonly number[];
  readonly result: number;
  readonly shift: number;
}

/**
 * Decodes a Google encoded polyline (precision 5). Returns `null` for
 * malformed input instead of throwing.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export const decodePolyline = (encoded: string): readonly LatLng[] | null => {
  const state = [...encoded].reduce<DecodeState | null>(
    (current, char) => {
      const code = char.charCodeAt(0) - 63;
      if (current === null || code < 0 || code > 63 || current.shift > 30) {
        return null;
      }
      const result = current.result | ((code & 0x1f) << current.shift);
      if (code >= 0x20) {
        return { ...current, result, shift: current.shift + 5 };
      }
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      return { values: [...current.values, delta], result: 0, shift: 0 };
    },
    { values: [], result: 0, shift: 0 },
  );
  if (state === null || state.shift !== 0 || state.values.length % 2 !== 0) {
    return null;
  }
  const pairs = state.values.flatMap((value, index, all) =>
    index % 2 === 0 ? [[value, all[index + 1] ?? 0] as const] : [],
  );
  return pairs.reduce<readonly LatLng[]>((points, [dLat, dLng]) => {
    const previous = points.at(-1) ?? { lat: 0, lng: 0 };
    return [
      ...points,
      {
        lat: Math.round((previous.lat + dLat / 1e5) * 1e5) / 1e5,
        lng: Math.round((previous.lng + dLng / 1e5) * 1e5) / 1e5,
      },
    ];
  }, []);
};

/** Distance in metres from `point` to the segment `a`–`b` (flat-earth, fine at city scale). */
const distanceToSegment = (point: LatLng, a: LatLng, b: LatLng): number => {
  const metresPerLng = 111_320 * Math.cos((a.lat * Math.PI) / 180);
  const toXY = ({ lat, lng }: LatLng) => ({
    x: (lng - a.lng) * metresPerLng,
    y: (lat - a.lat) * 110_540,
  });
  const p = toXY(point);
  const end = toXY(b);
  const length = end.x ** 2 + end.y ** 2;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, (p.x * end.x + p.y * end.y) / length));
  return Math.hypot(p.x - t * end.x, p.y - t * end.y);
};

/**
 * Douglas–Peucker simplification: drops points closer than `tolerance`
 * metres to the line, so a route stays faithful but small.
 */
export const simplifyPath = (points: readonly LatLng[], tolerance: number): readonly LatLng[] => {
  const first = points[0];
  const last = points.at(-1);
  if (points.length <= 2 || first === undefined || last === undefined) {
    return points;
  }
  const { index, distance } = points.slice(1, -1).reduce(
    (best, point, i) => {
      const d = distanceToSegment(point, first, last);
      return d > best.distance ? { index: i + 1, distance: d } : best;
    },
    { index: 0, distance: -1 },
  );
  return distance <= tolerance
    ? [first, last]
    : [
        ...simplifyPath(points.slice(0, index + 1), tolerance).slice(0, -1),
        ...simplifyPath(points.slice(index), tolerance),
      ];
};

/** Simplifies harder until the path fits in `maxPoints`. */
export const fitPath = (points: readonly LatLng[], maxPoints: number): readonly LatLng[] =>
  [2, 5, 10, 20, 50, 100, 250].reduce(
    (path, tolerance) => (path.length <= maxPoints ? path : simplifyPath(points, tolerance)),
    simplifyPath(points, 1),
  );
