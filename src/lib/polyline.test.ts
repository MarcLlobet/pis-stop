import { describe, expect, it } from 'vitest';

import { decodePolyline, fitPath, simplifyPath } from './polyline';

describe('decodePolyline', () => {
  it('decodes the example from Google’s documentation', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it('decodes an empty string to no points', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  it.each([
    ['a character out of range', '_p~iF~ps|U \u0000'],
    ['a truncated value', '_p~iF~ps|U_ulLnnqC_mqNvxq'],
    ['an odd number of values', '_p~iF'],
  ])('rejects %s', (_, encoded) => {
    expect(decodePolyline(encoded)).toBeNull();
  });
});

describe('simplifyPath', () => {
  const straight = Array.from({ length: 11 }, (_, i) => ({ lat: 41.38, lng: 2.17 + i * 0.001 }));

  it('collapses points on a straight line', () => {
    expect(simplifyPath(straight, 1)).toEqual([straight[0], straight[10]]);
  });

  it('keeps corners', () => {
    const corner = [
      { lat: 41.38, lng: 2.17 },
      { lat: 41.38, lng: 2.18 },
      { lat: 41.39, lng: 2.18 },
    ];
    expect(simplifyPath(corner, 5)).toEqual(corner);
  });

  it('leaves tiny paths alone', () => {
    expect(simplifyPath(straight.slice(0, 2), 5)).toEqual(straight.slice(0, 2));
  });
});

describe('fitPath', () => {
  it('keeps simplifying until the path fits', () => {
    const zigzag = Array.from({ length: 500 }, (_, i) => ({
      lat: 41.38 + (i % 2) * 0.0001,
      lng: 2.17 + i * 0.0001,
    }));
    expect(fitPath(zigzag, 50).length).toBeLessThanOrEqual(50);
  });
});
