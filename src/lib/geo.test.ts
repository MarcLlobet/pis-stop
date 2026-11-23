import { describe, expect, it } from 'vitest';

import { centroid, distanceMeters, nearestStop } from './geo';
import type { Stop } from './types';

const stop = (id: string, lat: number, lng: number): Stop => ({
  kind: 'stop',
  id,
  name: id,
  order: 0,
  position: { lat, lng },
});

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters({ lat: 41.4, lng: 2.17 }, { lat: 41.4, lng: 2.17 })).toBe(0);
  });

  it('matches a known distance (Barcelona to Madrid ≈ 505 km)', () => {
    const km = distanceMeters({ lat: 41.3874, lng: 2.1686 }, { lat: 40.4168, lng: -3.7038 }) / 1000;
    expect(km).toBeGreaterThan(500);
    expect(km).toBeLessThan(510);
  });
});

describe('nearestStop', () => {
  const stops = [stop('a', 41.4, 2.17), stop('b', 41.401, 2.17)];

  it('picks the closest stop within range', () => {
    expect(nearestStop(stops, { lat: 41.4009, lng: 2.17 })?.id).toBe('b');
    expect(nearestStop(stops, { lat: 41.4001, lng: 2.17 })?.id).toBe('a');
  });

  it('returns null when every stop is too far', () => {
    expect(nearestStop(stops, { lat: 41.5, lng: 2.17 })).toBeNull();
    expect(nearestStop(stops, { lat: 41.4005, lng: 2.17 }, 10)).toBeNull();
  });

  it('returns null without stops', () => {
    expect(nearestStop([], { lat: 41.4, lng: 2.17 })).toBeNull();
  });
});

describe('centroid', () => {
  it('averages points and returns null for none', () => {
    expect(
      centroid([
        { lat: 0, lng: 0 },
        { lat: 2, lng: 4 },
      ]),
    ).toEqual({ lat: 1, lng: 2 });
    expect(centroid([])).toBeNull();
  });
});
