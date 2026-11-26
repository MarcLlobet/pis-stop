import { describe, expect, it } from 'vitest';

import {
  chainWays,
  findLine,
  type MetroLine,
  normalizeName,
  parseMetroFile,
  parseOverpass,
  sliceLine,
} from './metro';

const p = (lng: number) => ({ lat: 41.4, lng });

describe('chainWays', () => {
  it('joins ways in order, flipping the ones listed backwards', () => {
    expect(
      chainWays([
        [p(1), p(2)],
        [p(3), p(2)],
        [p(3), p(4)],
      ]),
    ).toEqual([p(1), p(2), p(3), p(4)]);
  });

  it('flips a way that only connects at its start to the chain so far', () => {
    expect(
      chainWays([
        [p(2), p(1)],
        [p(2), p(3)],
      ]),
    ).toEqual([p(3), p(2), p(1)]);
  });

  it('joins ways regardless of the order they were listed in', () => {
    // Real OSM route relations do not always list their ways in travel
    // order; joining them in the given order used to leave a jump between
    // unconnected ways instead of finding where each one really attaches.
    expect(
      chainWays([
        [p(3), p(4)],
        [p(1), p(2)],
        [p(3), p(2)],
      ]),
    ).toEqual([p(1), p(2), p(3), p(4)]);
  });

  it('handles no ways', () => {
    expect(chainWays([])).toEqual([]);
  });
});

const overpass = {
  elements: [
    {
      type: 'relation',
      tags: { ref: 'L4', name: 'L4: Trinitat Nova → La Pau', colour: '#ffc20e' },
      members: [
        { type: 'node', ref: 1, role: 'stop', lat: 41.4, lon: 2.1 },
        { type: 'node', ref: 2, role: 'stop_entry_only', lat: 41.4, lon: 2.2 },
        { type: 'node', ref: 3, role: 'stop', lat: 41.4, lon: 2.3 },
        {
          type: 'way',
          role: '',
          geometry: [
            { lat: 41.4, lon: 2.1 },
            { lat: 41.4, lon: 2.2 },
          ],
        },
        {
          type: 'way',
          role: '',
          geometry: [
            { lat: 41.4, lon: 2.3 },
            { lat: 41.4, lon: 2.2 },
          ],
        },
        { type: 'node', ref: 9, role: 'platform', lat: 41.4, lon: 2.25 },
        // A platform way, far from the track: must be excluded, or it would
        // derail the chained path (and sliceLine along with it).
        {
          type: 'way',
          role: 'platform',
          geometry: [
            { lat: 41.9, lon: 2.9 },
            { lat: 41.95, lon: 2.95 },
          ],
        },
      ],
    },
    // The other direction, with fewer stops: ignored.
    {
      type: 'relation',
      tags: { ref: 'L4', colour: '#ffc20e' },
      members: [
        { type: 'node', ref: 3, role: 'stop', lat: 41.4, lon: 2.3 },
        { type: 'node', ref: 1, role: 'stop', lat: 41.4, lon: 2.1 },
        {
          type: 'way',
          role: '',
          geometry: [
            { lat: 41.4, lon: 2.3 },
            { lat: 41.4, lon: 2.1 },
          ],
        },
      ],
    },
    { type: 'node', id: 1, lat: 41.4, lon: 2.1, tags: { name: 'Joanic' } },
    { type: 'node', id: 2, lat: 41.4, lon: 2.2, tags: { name: 'Verdaguer' } },
    { type: 'node', id: 3, lat: 41.4, lon: 2.3, tags: { name: 'Girona' } },
    { type: 'relation', tags: { name: 'no ref' }, members: [] },
  ],
};

describe('parseOverpass', () => {
  it('builds one line per ref, with its track, colour and named stops', () => {
    const { lines } = parseOverpass(overpass);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ ref: 'L4', color: '#FFC20E' });
    expect(lines[0]?.stops.map(({ name }) => name)).toEqual(['Joanic', 'Verdaguer', 'Girona']);
    expect(lines[0]?.path.at(-1)).toEqual({ lat: 41.4, lng: 2.3 });
  });

  it('survives garbage', () => {
    expect(parseOverpass(null)).toEqual({ lines: [] });
  });

  it('round-trips through the metro.json validator', () => {
    const metro = parseOverpass(overpass);
    expect(parseMetroFile(JSON.parse(JSON.stringify(metro)))).toEqual(metro);
    expect(parseMetroFile({ lines: [{ ref: '<b>' }] })).toBeNull();
    expect(parseMetroFile('nope')).toBeNull();
  });
});

describe('sliceLine', () => {
  const line: MetroLine = parseOverpass(overpass).lines[0]!;

  it('cuts the track between two stations in the direction of travel', () => {
    const forward = sliceLine(line, 'Joanic', 'Girona')!;
    expect(forward.stops).toBe(2);
    expect(forward.headsign).toBe('Girona');
    expect(forward.path[0]).toEqual(line.stops[0]?.position);
    expect(forward.path.at(-1)).toEqual(line.stops[2]?.position);

    const back = sliceLine(line, 'girona', 'JOANIC')!;
    expect(back.headsign).toBe('Joanic');
    expect(back.path[0]).toEqual({ lat: 41.4, lng: 2.3 });
  });

  it('matches names without accents or with a prefix', () => {
    expect(sliceLine(line, 'Verdag', 'Joanic')?.stops).toBe(1);
  });

  it('returns null for unknown or identical stations', () => {
    expect(sliceLine(line, 'Sants', 'Joanic')).toBeNull();
    expect(sliceLine(line, 'Joanic', 'Joanic')).toBeNull();
  });

  it('finds lines case-insensitively', () => {
    expect(findLine({ lines: [line] }, 'l4')).toBe(line);
    expect(findLine({ lines: [line] }, 'L5')).toBeUndefined();
  });

  it('normalises names', () => {
    expect(normalizeName('Santa Eulàlia')).toBe('santaeulalia');
  });
});
