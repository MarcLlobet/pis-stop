import { describe, expect, it } from 'vitest';

import { buildId, buildUrl, DEFAULT_BBOX, formatBbox, parseBbox, recentBuilds } from './map-area';

describe('parseBbox', () => {
  it('parses the default Barcelona box and round-trips it', () => {
    const bbox = parseBbox(DEFAULT_BBOX);
    expect(bbox).toEqual({ west: 2.05, south: 41.32, east: 2.24, north: 41.47 });
    expect(formatBbox(bbox!)).toBe(DEFAULT_BBOX);
  });

  it.each([
    ['empty', ''],
    ['three numbers', '1,2,3'],
    ['shell injection', '2.05,41.32,2.24,41.47;rm -rf /'],
    ['a flag', '--output=x,1,2,3'],
    ['swapped corners', '2.24,41.47,2.05,41.32'],
    ['out of range', '-200,0,10,10'],
  ])('rejects %s', (_, text) => {
    expect(parseBbox(text)).toBeNull();
  });
});

describe('Protomaps builds', () => {
  it('lists daily build ids, newest first', () => {
    expect(recentBuilds(new Date('2026-11-23T10:00:00Z'), 3)).toEqual([
      '20261123',
      '20261122',
      '20261121',
    ]);
    expect(buildId(new Date('2026-01-05T23:59:00Z'))).toBe('20260105');
    expect(buildUrl('20261123')).toBe('https://build.protomaps.com/20261123.pmtiles');
  });
});
