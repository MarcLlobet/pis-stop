/**
 * The map is a Protomaps vector extract served from this same site
 * (public/map/area.pmtiles), so no third party learns which area people look at.
 */
export const MAP_FILE = 'map/area.pmtiles';

/** Default extract: the city of Barcelona. */
export const DEFAULT_BBOX = '2.05,41.32,2.24,41.47';

/** Protomaps basemap builds stop at zoom 15; Leaflet overzooms beyond that. */
export const MAX_DATA_ZOOM = 15;

export interface Bbox {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

const NUMBER = String.raw`-?\d{1,3}(?:\.\d{1,7})?`;
const BBOX = new RegExp(`^${NUMBER},${NUMBER},${NUMBER},${NUMBER}$`);

/** Strict parsing: the value ends up as a command-line argument. */
export const parseBbox = (text: string): Bbox | null => {
  if (!BBOX.test(text)) {
    return null;
  }
  const [west = 0, south = 0, east = 0, north = 0] = text.split(',').map(Number);
  const valid =
    west >= -180 && east <= 180 && south >= -90 && north <= 90 && west < east && south < north;
  return valid ? { west, south, east, north } : null;
};

export const formatBbox = ({ west, south, east, north }: Bbox): string =>
  [west, south, east, north].join(',');

/** `YYYYMMDD` of a date, in UTC. */
export const buildId = (date: Date): string => date.toISOString().slice(0, 10).replaceAll('-', '');

/** Daily Protomaps builds to try, newest first. */
export const recentBuilds = (today: Date, days: number): readonly string[] =>
  Array.from({ length: days }, (_, index) =>
    buildId(new Date(today.getTime() - index * 86_400_000)),
  );

export const buildUrl = (build: string): string => `https://build.protomaps.com/${build}.pmtiles`;
