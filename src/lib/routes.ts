/**
 * Turns Google Routes API responses into itinerary options. Used only by the
 * organizer CLI (`pnpm event:route`): the app never talks to Google.
 */
import { decodePolyline, fitPath } from './polyline';
import type { LatLng, LegOption, Ride, Segment, Station, TravelMode } from './types';

export type RequestedMode = 'transit' | 'walk' | 'bike';

const GOOGLE_MODES: Readonly<Record<RequestedMode, string>> = {
  transit: 'TRANSIT',
  walk: 'WALK',
  bike: 'BICYCLE',
};

export const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/** Only the fields we use: smaller responses, and Google bills by field mask. */
export const ROUTES_FIELD_MASK = [
  'routes.duration',
  'routes.legs.steps.travelMode',
  'routes.legs.steps.distanceMeters',
  'routes.legs.steps.staticDuration',
  'routes.legs.steps.polyline.encodedPolyline',
  'routes.legs.steps.transitDetails',
].join(',');

const MAX_PATH_POINTS = 400;

export const routesRequest = (
  from: LatLng,
  to: LatLng,
  mode: RequestedMode,
  departure: Date | null,
): Readonly<Record<string, unknown>> => ({
  origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
  destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
  travelMode: GOOGLE_MODES[mode],
  languageCode: 'ca',
  units: 'METRIC',
  ...(mode === 'transit' && departure !== null ? { departureTime: departure.toISOString() } : {}),
});

type Json = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null;

const field = (value: unknown, ...path: readonly string[]): unknown =>
  path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);

const seconds = (value: unknown): number | null =>
  typeof value === 'string' && /^\d+(\.\d+)?s$/.test(value) ? Number.parseFloat(value) : null;

const toMinutes = (secs: number): number => (secs <= 0 ? 0 : Math.max(1, Math.round(secs / 60)));

const toText = (value: unknown, max = 80): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/** Google vehicle types → our travel modes. */
export const vehicleMode = (type: unknown): TravelMode => {
  switch (type) {
    case 'BUS':
    case 'INTERCITY_BUS':
    case 'TROLLEYBUS':
    case 'SHARE_TAXI':
      return 'bus';
    case 'TRAM':
    case 'LIGHT_RAIL':
    case 'CABLE_CAR':
    case 'FUNICULAR':
      return 'tram';
    case 'RAIL':
    case 'HEAVY_RAIL':
    case 'COMMUTER_TRAIN':
    case 'HIGH_SPEED_TRAIN':
    case 'LONG_DISTANCE_TRAIN':
    case 'MONORAIL':
      return 'train';
    default:
      return 'metro';
  }
};

const station = (stop: unknown): Station | null => {
  const lat = field(stop, 'location', 'latLng', 'latitude');
  const lng = field(stop, 'location', 'latLng', 'longitude');
  const name = toText(field(stop, 'name'));
  return typeof lat === 'number' && typeof lng === 'number' && name !== ''
    ? { name, position: { lat, lng } }
    : null;
};

const ride = (details: unknown): Ride | null => {
  const from = station(field(details, 'stopDetails', 'departureStop'));
  const to = station(field(details, 'stopDetails', 'arrivalStop'));
  const vehicle = vehicleMode(field(details, 'transitLine', 'vehicle', 'type'));
  const name = toText(field(details, 'transitLine', 'nameShort'), 10).replace(/[^A-Za-z0-9 ]/g, '');
  const color = toText(field(details, 'transitLine', 'color'), 7);
  const stops = field(details, 'stopCount');
  return from === null || to === null
    ? null
    : {
        line: name === '' ? vehicle.toUpperCase() : name,
        color: /^#[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : null,
        vehicle,
        from,
        to,
        headsign: toText(field(details, 'headsign')),
        stops: typeof stops === 'number' && Number.isInteger(stops) ? Math.min(stops, 200) : 0,
      };
};

interface RawSegment {
  readonly mode: Segment['mode'];
  readonly seconds: number;
  readonly meters: number;
  readonly path: readonly LatLng[];
  readonly ride: Ride | null;
}

const rawSegment = (step: unknown): RawSegment | null => {
  const travelMode = field(step, 'travelMode');
  const path = decodePolyline(toText(field(step, 'polyline', 'encodedPolyline'), 100_000));
  const secs = seconds(field(step, 'staticDuration')) ?? 0;
  const meters = field(step, 'distanceMeters');
  const details = field(step, 'transitDetails');
  const parsedRide = travelMode === 'TRANSIT' ? ride(details) : null;
  if (path === null || (travelMode === 'TRANSIT' && parsedRide === null)) {
    return null;
  }
  return {
    mode: parsedRide !== null ? 'ride' : travelMode === 'BICYCLE' ? 'bike' : 'walk',
    seconds: secs,
    meters: typeof meters === 'number' ? Math.round(meters) : 0,
    path,
    ride: parsedRide,
  };
};

/** Google splits walks into one step per turn; we show one walk between rides. */
const mergeSteps = (segments: readonly RawSegment[]): readonly RawSegment[] =>
  segments.reduce<readonly RawSegment[]>((merged, segment) => {
    const previous = merged.at(-1);
    return previous?.mode === segment.mode && segment.mode !== 'ride'
      ? [
          ...merged.slice(0, -1),
          {
            ...previous,
            seconds: previous.seconds + segment.seconds,
            meters: previous.meters + segment.meters,
            path: [...previous.path, ...segment.path.slice(1)],
          },
        ]
      : [...merged, segment];
  }, []);

/**
 * The first route of a Routes API response as an itinerary option, or `null`
 * when there is none (no transit at that hour, no bike data, an error…).
 */
export const parseRoutesResponse = (json: unknown, mode: RequestedMode): LegOption | null => {
  const route = field(json, 'routes', '0');
  const total = seconds(field(route, 'duration'));
  const legs = field(route, 'legs');
  if (total === null || !Array.isArray(legs)) {
    return null;
  }
  const steps: readonly unknown[] = legs.flatMap((leg: unknown) => {
    const legSteps = field(leg, 'steps');
    return Array.isArray(legSteps) ? (legSteps as readonly unknown[]) : [];
  });
  const raw = steps.map(rawSegment);
  if (raw.some((segment) => segment === null)) {
    return null;
  }
  const segments: readonly Segment[] = mergeSteps(raw as readonly RawSegment[])
    .slice(0, 20)
    .map((segment) => ({
      mode: segment.mode,
      minutes: toMinutes(segment.seconds),
      meters: Math.min(segment.meters, 200_000),
      path: fitPath(segment.path, MAX_PATH_POINTS),
      ride: segment.ride,
    }));
  const rides = segments.flatMap(({ ride: r }) => (r === null ? [] : [r]));
  if (mode === 'transit' && rides.length === 0) {
    return null; // Walking is faster: the walk option already covers it.
  }
  return {
    mode: mode === 'transit' ? (rides[0]?.vehicle ?? 'metro') : mode,
    minutes: Math.min(toMinutes(total), 600),
    steps: rides.slice(0, 5).map(({ line, from, to }) => ({ line, from: from.name, to: to.name })),
    segments,
  };
};
