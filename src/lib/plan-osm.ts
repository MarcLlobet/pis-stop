/**
 * Card-free itinerary planning, for the organizer CLI (`pnpm event:route`):
 * the metro follows the real OpenStreetMap track between the stations you
 * wrote in event.json, and the walks follow the streets (OSRM foot router).
 */
import { distanceMeters } from './geo';
import { findLine, type LineSlice, type MetroLine, type MetroMap, sliceLine } from './metro';
import { decodePolyline, fitPath } from './polyline';
import type { LatLng, Leg, LegOption, Segment } from './types';

export type Profile = 'foot' | 'bike';

export interface StreetRoute {
  readonly path: readonly LatLng[];
  readonly seconds: number;
  readonly meters: number;
}

/** Looks up a street route; `null` when the router has none. */
export type StreetRouter = (
  profile: Profile,
  from: LatLng,
  to: LatLng,
) => Promise<StreetRoute | null>;

/** FOSSGIS public OSRM servers: free, no key, fair use (one request per second). */
export const osrmUrl = (profile: Profile, from: LatLng, to: LatLng): string =>
  `https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/` +
  `${String(from.lng)},${String(from.lat)};${String(to.lng)},${String(to.lat)}` +
  '?overview=full&geometries=polyline';

export const parseOsrm = (json: unknown): StreetRoute | null => {
  const route =
    typeof json === 'object' &&
    json !== null &&
    Array.isArray((json as { routes?: unknown }).routes)
      ? ((json as { routes: readonly unknown[] }).routes[0] as Record<string, unknown> | undefined)
      : undefined;
  const geometry = route?.['geometry'];
  const seconds = route?.['duration'];
  const meters = route?.['distance'];
  const path = typeof geometry === 'string' ? decodePolyline(geometry) : null;
  return path !== null && typeof seconds === 'number' && typeof meters === 'number'
    ? { path, seconds, meters }
    : null;
};

const minutes = (seconds: number): number =>
  seconds <= 0 ? 0 : Math.max(1, Math.round(seconds / 60));

/** Barcelona metro: roughly 1.8 minutes per stop, including dwell time. */
const rideMinutes = (stops: number): number => Math.max(2, Math.round(stops * 1.8));

const walk = async (router: StreetRouter, from: LatLng, to: LatLng): Promise<Segment> => {
  const route = await router('foot', from, to);
  return {
    mode: 'walk',
    minutes: route === null ? 0 : minutes(route.seconds),
    meters: route === null ? 0 : Math.round(route.meters),
    path: fitPath(route?.path ?? [from, to], 400),
    ride: null,
  };
};

const pathLength = (path: readonly LatLng[]): number =>
  path.slice(1).reduce((sum, point, index) => sum + distanceMeters(path[index] ?? point, point), 0);

interface PlannedRide {
  readonly line: MetroLine;
  readonly slice: LineSlice;
}

const rideSegment = ({ line, slice }: PlannedRide): Segment => ({
  mode: 'ride',
  minutes: rideMinutes(slice.stops),
  meters: Math.round(pathLength(slice.path)),
  path: fitPath(slice.path, 400),
  ride: {
    line: line.ref,
    color: line.color,
    vehicle: 'metro',
    from: slice.from,
    to: slice.to,
    headsign: slice.headsign,
    stops: slice.stops,
  },
});

/** Changing lines inside one station is not worth its own walking row. */
const TRANSFER_METERS = 40;

/**
 * Plans the metro option typed in event.json: walk to the first station, ride
 * each line along its real track, walk between platforms when changing, walk
 * to the next flat. `null` if a line or station is not in the metro data.
 */
const planTransit = async (
  option: LegOption,
  from: LatLng,
  to: LatLng,
  metro: MetroMap,
  router: StreetRouter,
): Promise<readonly Segment[] | null> => {
  const rides = option.steps.map((step): PlannedRide | null => {
    const line = findLine(metro, step.line);
    const slice = line === undefined ? null : sliceLine(line, step.from, step.to);
    return line === undefined || slice === null ? null : { line, slice };
  });
  const found = rides.filter((ride): ride is PlannedRide => ride !== null);
  const last = found.at(-1);
  if (last === undefined || found.length !== rides.length) {
    return null;
  }
  const legs = await found.reduce<Promise<readonly Segment[]>>(async (previous, ride, index) => {
    const done = await previous;
    const start = found[index - 1]?.slice.to.position ?? from;
    const access = await walk(router, start, ride.slice.from.position);
    const isTransfer = index > 0 && access.meters < TRANSFER_METERS;
    return [...done, ...(isTransfer ? [] : [access]), rideSegment(ride)];
  }, Promise.resolve([]));
  return [...legs, await walk(router, last.slice.to.position, to)];
};

/**
 * Adds real paths to every option of a leg: metro along the track, walking
 * and cycling along the streets. Options it cannot plan are kept as typed.
 */
export const planLegOsm = async (
  leg: Leg,
  from: LatLng,
  to: LatLng,
  metro: MetroMap,
  router: StreetRouter,
): Promise<Leg> => {
  const options = await leg.options.reduce<Promise<readonly LegOption[]>>(
    async (previous, option) => {
      const done = await previous;
      if (option.mode === 'walk' || option.mode === 'bike') {
        const route = await router(option.mode === 'walk' ? 'foot' : 'bike', from, to);
        const segment: Segment | null =
          route === null
            ? null
            : {
                mode: option.mode,
                minutes: minutes(route.seconds),
                meters: Math.round(route.meters),
                path: fitPath(route.path, 400),
                ride: null,
              };
        return [
          ...done,
          segment === null
            ? option
            : { ...option, minutes: option.minutes || segment.minutes, segments: [segment] },
        ];
      }
      const segments = await planTransit(option, from, to, metro, router);
      return [...done, segments === null ? option : { ...option, segments }];
    },
    Promise.resolve([]),
  );
  return { ...leg, options };
};
