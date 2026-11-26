import { describe, expect, it } from 'vitest';

import { centroid, distanceMeters } from './geo';

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
