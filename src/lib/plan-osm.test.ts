import { describe, expect, it } from 'vitest';

import type { MetroMap } from './metro';
import { osrmUrl, parseOsrm, planLegOsm, type StreetRouter } from './plan-osm';
import type { Leg } from './types';

const at = (lng: number) => ({ lat: 41.4, lng });

const metro: MetroMap = {
  lines: [
    {
      ref: 'L4',
      name: 'L4',
      color: '#FFC20E',
      path: [at(2.1), at(2.2), at(2.3)],
      stops: [
        { name: 'Joanic', position: at(2.1) },
        { name: 'Verdaguer', position: at(2.2) },
      ],
    },
    {
      ref: 'L5',
      name: 'L5',
      color: '#0078BF',
      path: [at(2.2), at(2.25), at(2.4)],
      stops: [
        { name: 'Verdaguer', position: at(2.2) },
        { name: 'Badal', position: at(2.4) },
      ],
    },
  ],
};

/** A fake router: straight lines, 1 m/s, so results are easy to check. */
const router: StreetRouter = (_, from, to) =>
  Promise.resolve({ path: [from, to], seconds: 300, meters: 400 });

const leg = (options: Leg['options']): Leg => ({ options, path: [] });

describe('planLegOsm', () => {
  it('plans walk → L4 → L5 → walk along the real tracks', async () => {
    const planned = await planLegOsm(
      leg([
        {
          mode: 'metro',
          minutes: 26,
          steps: [
            { line: 'L4', from: 'Joanic', to: 'Verdaguer' },
            { line: 'L5', from: 'Verdaguer', to: 'Badal' },
          ],
          segments: [],
        },
      ]),
      at(2.05),
      at(2.45),
      metro,
      router,
    );
    const option = planned.options[0]!;
    expect(option.minutes).toBe(26);
    expect(option.segments.map(({ mode, ride }) => ride?.line ?? mode)).toEqual([
      'walk',
      'L4',
      'walk',
      'L5',
      'walk',
    ]);
    expect(option.segments[1]?.ride).toMatchObject({
      color: '#FFC20E',
      from: { name: 'Joanic' },
      to: { name: 'Verdaguer' },
      stops: 1,
    });
  });

  it('skips the walking row for a change within the same station', async () => {
    const shortWalks: StreetRouter = (_, from, to) =>
      Promise.resolve({ path: [from, to], seconds: 60, meters: from === to ? 0 : 20 });
    const planned = await planLegOsm(
      leg([
        {
          mode: 'metro',
          minutes: 20,
          steps: [
            { line: 'L4', from: 'Joanic', to: 'Verdaguer' },
            { line: 'L5', from: 'Verdaguer', to: 'Badal' },
          ],
          segments: [],
        },
      ]),
      at(2.05),
      at(2.45),
      metro,
      shortWalks,
    );
    expect(planned.options[0]?.segments.map(({ mode }) => mode)).toEqual([
      'walk',
      'ride',
      'ride',
      'walk',
    ]);
  });

  it('keeps an option as typed when a line or station is unknown', async () => {
    const option = {
      mode: 'metro' as const,
      minutes: 10,
      steps: [{ line: 'L9', from: 'a', to: 'b' }],
      segments: [],
    };
    expect((await planLegOsm(leg([option]), at(2), at(3), metro, router)).options[0]).toBe(option);
  });

  it('routes walking and cycling options along the streets', async () => {
    const planned = await planLegOsm(
      leg([
        { mode: 'walk', minutes: 0, steps: [], segments: [] },
        { mode: 'bike', minutes: 7, steps: [], segments: [] },
      ]),
      at(2),
      at(3),
      metro,
      router,
    );
    expect(planned.options.map(({ minutes, segments }) => [minutes, segments.length])).toEqual([
      [5, 1],
      [7, 1],
    ]);
  });

  it('keeps an option when the router finds nothing', async () => {
    const option = { mode: 'bike' as const, minutes: 7, steps: [], segments: [] };
    const nothing: StreetRouter = () => Promise.resolve(null);
    expect((await planLegOsm(leg([option]), at(2), at(3), metro, nothing)).options[0]).toBe(option);
  });
});

describe('OSRM', () => {
  it('builds the FOSSGIS URL with lng,lat order', () => {
    expect(osrmUrl('foot', { lat: 41.4, lng: 2.18 }, { lat: 41.39, lng: 2.17 })).toBe(
      'https://routing.openstreetmap.de/routed-foot/route/v1/driving/2.18,41.4;2.17,41.39?overview=full&geometries=polyline',
    );
  });

  it('parses a route and rejects anything else', () => {
    expect(
      parseOsrm({ routes: [{ geometry: '_p~iF~ps|U_ulLnnqC', duration: 120, distance: 150 }] }),
    ).toEqual({
      path: [
        { lat: 38.5, lng: -120.2 },
        { lat: 40.7, lng: -120.95 },
      ],
      seconds: 120,
      meters: 150,
    });
    expect(parseOsrm({ code: 'NoRoute' })).toBeNull();
    expect(parseOsrm({ routes: [{ geometry: '_p~', duration: 1, distance: 1 }] })).toBeNull();
  });
});
