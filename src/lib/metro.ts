/**
 * Metro lines from OpenStreetMap (public data, fetched with the Overpass API
 * by `pnpm map:metro` into public/map/metro.json). Used to draw the network
 * on the map and to cut the real track between two stations.
 */
import { distanceMeters } from './geo';
import { isLatLng } from './meta';
import { fitPath } from './polyline';
import type { LatLng, Station } from './types';

export const METRO_FILE = 'map/metro.json';

export interface MetroLine {
  readonly ref: string;
  readonly name: string;
  readonly color: string;
  /** The track, in the direction of `stops`. */
  readonly path: readonly LatLng[];
  readonly stops: readonly Station[];
}

export interface MetroMap {
  readonly lines: readonly MetroLine[];
}

type Json = Readonly<Record<string, unknown>>;
const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null;
const text = (value: unknown, max = 80): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const samePoint = (a: LatLng | undefined, b: LatLng | undefined): boolean =>
  a !== undefined && b !== undefined && distanceMeters(a, b) < 1;

/**
 * Joins the ways of a route relation into one line. Ways may be listed in
 * either direction, so each one is flipped when that makes it connect.
 */
export const chainWays = (ways: readonly (readonly LatLng[])[]): readonly LatLng[] => {
  const [first, second] = ways;
  if (first === undefined) {
    return [];
  }
  const start =
    second !== undefined && (samePoint(first[0], second[0]) || samePoint(first[0], second.at(-1)))
      ? [...first].reverse()
      : first;
  return ways.slice(1).reduce<readonly LatLng[]>((line, way) => {
    const end = line.at(-1);
    const oriented = samePoint(end, way.at(-1)) ? [...way].reverse() : way;
    return [...line, ...(samePoint(end, oriented[0]) ? oriented.slice(1) : oriented)];
  }, start);
};

const point = (value: unknown): LatLng | null => {
  const lat = isRecord(value) ? value['lat'] : undefined;
  const lng = isRecord(value) ? value['lon'] : undefined;
  return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
};

const COLOR = /^#[0-9a-fA-F]{6}$/;

/** Turns an Overpass `out geom` answer into one line per `ref` (one direction each). */
export const parseOverpass = (json: unknown): MetroMap => {
  const elements = isRecord(json) && Array.isArray(json['elements']) ? json['elements'] : [];
  const names = new Map(
    elements.flatMap((element: unknown) =>
      isRecord(element) && element['type'] === 'node' && isRecord(element['tags'])
        ? [[element['id'], text(element['tags']['name'])] as const]
        : [],
    ),
  );
  const lines = elements.flatMap((element: unknown): readonly MetroLine[] => {
    if (!isRecord(element) || element['type'] !== 'relation' || !isRecord(element['tags'])) {
      return [];
    }
    const tags = element['tags'];
    const members = Array.isArray(element['members']) ? (element['members'] as unknown[]) : [];
    const ways = members.flatMap((member) =>
      isRecord(member) && member['type'] === 'way' && Array.isArray(member['geometry'])
        ? [member['geometry'].map(point).filter((p): p is LatLng => p !== null)]
        : [],
    );
    const stops = members.flatMap((member): readonly Station[] => {
      if (!isRecord(member) || member['type'] !== 'node') {
        return [];
      }
      const role = text(member['role']);
      const position = point(member);
      const name = names.get(member['ref']) ?? '';
      return role.startsWith('stop') && position !== null && name !== ''
        ? [{ name, position }]
        : [];
    });
    const ref = text(tags['ref'], 10).replace(/[^A-Za-z0-9]/g, '');
    const color = text(tags['colour'], 7);
    return ref === '' || ways.length === 0 || stops.length < 2
      ? []
      : [
          {
            ref,
            name: text(tags['name']),
            color: COLOR.test(color) ? color.toUpperCase() : '#888888',
            path: fitPath(chainWays(ways), 2000),
            stops,
          },
        ];
  });
  // Each line is mapped twice (one relation per direction): keep the most complete one.
  const byRef = lines.reduce<ReadonlyMap<string, MetroLine>>((best, line) => {
    const current = best.get(line.ref);
    return current !== undefined && current.stops.length >= line.stops.length
      ? best
      : new Map([...best, [line.ref, line]]);
  }, new Map());
  return {
    lines: [...byRef.values()].sort((a, b) => a.ref.localeCompare(b.ref, 'ca', { numeric: true })),
  };
};

/** Validates metro.json as loaded by the app. */
export const parseMetroFile = (json: unknown): MetroMap | null => {
  const lines = isRecord(json) ? json['lines'] : undefined;
  if (!Array.isArray(lines) || lines.length > 40) {
    return null;
  }
  const parsed = lines.map((line: unknown): MetroLine | null => {
    if (!isRecord(line)) {
      return null;
    }
    const { ref, name, color, path, stops } = line;
    return typeof ref === 'string' &&
      /^[A-Za-z0-9]{1,10}$/.test(ref) &&
      typeof name === 'string' &&
      typeof color === 'string' &&
      COLOR.test(color) &&
      Array.isArray(path) &&
      path.length <= 5000 &&
      path.every(isLatLng) &&
      Array.isArray(stops) &&
      stops.every(
        (stop: unknown) =>
          isRecord(stop) && typeof stop['name'] === 'string' && isLatLng(stop['position']),
      )
      ? {
          ref,
          name: name.slice(0, 80),
          color,
          path: (path as readonly LatLng[]).map(({ lat, lng }) => ({ lat, lng })),
          stops: (stops as readonly Station[]).map(({ name: stopName, position }) => ({
            name: stopName.slice(0, 80),
            position: { lat: position.lat, lng: position.lng },
          })),
        }
      : null;
  });
  return parsed.every((line) => line !== null) ? { lines: parsed as readonly MetroLine[] } : null;
};

/** "Santa Eulàlia" matches "santa eulalia", "Sta. Eulàlia" does not: names must be written out. */
export const normalizeName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const findLine = (metro: MetroMap, ref: string): MetroLine | undefined =>
  metro.lines.find((line) => line.ref.toUpperCase() === ref.toUpperCase());

const findStop = (line: MetroLine, name: string): number => {
  const wanted = normalizeName(name);
  const exact = line.stops.findIndex((stop) => normalizeName(stop.name) === wanted);
  return exact !== -1
    ? exact
    : line.stops.findIndex((stop) => normalizeName(stop.name).startsWith(wanted));
};

const nearestIndex = (path: readonly LatLng[], target: LatLng): number =>
  path.reduce(
    (best, candidate, index) => {
      const distance = distanceMeters(candidate, target);
      return distance < best.distance ? { index, distance } : best;
    },
    { index: 0, distance: Number.POSITIVE_INFINITY },
  ).index;

export interface LineSlice {
  readonly path: readonly LatLng[];
  readonly from: Station;
  readonly to: Station;
  readonly stops: number;
  /** Terminal station in the direction of travel. */
  readonly headsign: string;
}

/** The real track of `line` between two stations, in the direction of travel. */
export const sliceLine = (line: MetroLine, fromName: string, toName: string): LineSlice | null => {
  const fromIndex = findStop(line, fromName);
  const toIndex = findStop(line, toName);
  const from = line.stops[fromIndex];
  const to = line.stops[toIndex];
  if (from === undefined || to === undefined || fromIndex === toIndex) {
    return null;
  }
  const a = nearestIndex(line.path, from.position);
  const b = nearestIndex(line.path, to.position);
  const forward = toIndex > fromIndex;
  const piece = a <= b ? line.path.slice(a, b + 1) : [...line.path.slice(b, a + 1)].reverse();
  return {
    path: [from.position, ...piece, to.position],
    from,
    to,
    stops: Math.abs(toIndex - fromIndex),
    headsign: (forward ? line.stops.at(-1) : line.stops[0])?.name ?? '',
  };
};
