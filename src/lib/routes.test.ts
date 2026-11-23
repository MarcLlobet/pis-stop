import { describe, expect, it } from 'vitest';

import { parseLegs } from './meta';
import { parseRoutesResponse, routesRequest, vehicleMode } from './routes';

/** Google's documented example polyline: three points. */
const POLYLINE = { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' };

const walk = (seconds: number, meters: number) => ({
  travelMode: 'WALK',
  staticDuration: `${seconds}s`,
  distanceMeters: meters,
  polyline: POLYLINE,
});

const metro = (line: string, color: string, from: string, to: string) => ({
  travelMode: 'TRANSIT',
  staticDuration: '300s',
  distanceMeters: 2400,
  polyline: POLYLINE,
  transitDetails: {
    stopDetails: {
      departureStop: { name: from, location: { latLng: { latitude: 41.4, longitude: 2.17 } } },
      arrivalStop: { name: to, location: { latLng: { latitude: 41.38, longitude: 2.14 } } },
    },
    headsign: 'Trinitat Nova',
    stopCount: 3,
    transitLine: { nameShort: line, color, vehicle: { type: 'SUBWAY' } },
  },
});

const response = (steps: readonly unknown[], duration = '1560s') => ({
  routes: [{ duration, legs: [{ steps }] }],
});

describe('parseRoutesResponse', () => {
  it('turns a transit route into walk / ride / ride / walk segments', () => {
    const option = parseRoutesResponse(
      response([
        walk(120, 150),
        walk(60, 80),
        metro('L4', '#ffc20e', 'Joanic', 'Verdaguer'),
        metro('L5', '#0078bf', 'Verdaguer', 'Badal'),
        walk(240, 300),
      ]),
      'transit',
    )!;

    expect(option.mode).toBe('metro');
    expect(option.minutes).toBe(26);
    expect(option.steps).toEqual([
      { line: 'L4', from: 'Joanic', to: 'Verdaguer' },
      { line: 'L5', from: 'Verdaguer', to: 'Badal' },
    ]);
    expect(option.segments.map(({ mode, minutes, meters }) => [mode, minutes, meters])).toEqual([
      ['walk', 3, 230],
      ['ride', 5, 2400],
      ['ride', 5, 2400],
      ['walk', 4, 300],
    ]);
    expect(option.segments[1]?.ride).toMatchObject({
      line: 'L4',
      color: '#FFC20E',
      vehicle: 'metro',
      headsign: 'Trinitat Nova',
      stops: 3,
      from: { name: 'Joanic', position: { lat: 41.4, lng: 2.17 } },
    });
    // The merged walk keeps one continuous path.
    expect(option.segments[0]?.path.length).toBeGreaterThan(2);
  });

  it('produces data the app accepts', () => {
    const option = parseRoutesResponse(
      response([walk(60, 80), metro('L1', '#e2001a', 'a', 'b')]),
      'transit',
    )!;
    expect(parseLegs([{ options: [option] }])).toEqual([{ options: [option], path: [] }]);
  });

  it('parses walking and cycling routes', () => {
    expect(parseRoutesResponse(response([walk(600, 900)], '600s'), 'walk')).toMatchObject({
      mode: 'walk',
      minutes: 10,
      segments: [{ mode: 'walk', minutes: 10, meters: 900, ride: null }],
    });
    const bike = { ...walk(240, 1200), travelMode: 'BICYCLE' };
    expect(parseRoutesResponse(response([bike], '240s'), 'bike')?.segments[0]?.mode).toBe('bike');
  });

  it('drops a transit route that is only walking', () => {
    expect(parseRoutesResponse(response([walk(600, 900)]), 'transit')).toBeNull();
  });

  it('sanitises line names and colours', () => {
    const option = parseRoutesResponse(response([metro('<L9>', 'red', 'a', 'b')]), 'transit')!;
    expect(option.segments[0]?.ride).toMatchObject({ line: 'L9', color: null });
  });

  it.each([
    ['no routes', {}],
    ['a missing duration', { routes: [{ legs: [] }] }],
    ['a broken polyline', response([{ ...walk(60, 80), polyline: { encodedPolyline: '_p~' } }])],
    [
      'a ride without stops',
      response([{ ...metro('L1', '#e2001a', 'a', 'b'), transitDetails: {} }]),
    ],
  ])('returns null for %s', (_, json) => {
    expect(parseRoutesResponse(json, 'transit')).toBeNull();
  });
});

describe('routesRequest', () => {
  const from = { lat: 41.4, lng: 2.18 };
  const to = { lat: 41.39, lng: 2.17 };

  it('asks for transit at a given departure time, in Catalan', () => {
    expect(routesRequest(from, to, 'transit', new Date('2026-12-12T19:00:00Z'))).toMatchObject({
      travelMode: 'TRANSIT',
      languageCode: 'ca',
      departureTime: '2026-12-12T19:00:00.000Z',
      origin: { location: { latLng: { latitude: 41.4, longitude: 2.18 } } },
    });
  });

  it('never sends a departure time for walking or cycling', () => {
    expect(routesRequest(from, to, 'bike', new Date())).not.toHaveProperty('departureTime');
    expect(routesRequest(from, to, 'walk', null)['travelMode']).toBe('WALK');
  });
});

describe('vehicleMode', () => {
  it.each([
    ['SUBWAY', 'metro'],
    ['BUS', 'bus'],
    ['TRAM', 'tram'],
    ['COMMUTER_TRAIN', 'train'],
    [undefined, 'metro'],
  ])('maps %s to %s', (type, mode) => {
    expect(vehicleMode(type)).toBe(mode);
  });
});
