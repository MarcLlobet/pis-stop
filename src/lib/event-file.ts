import { isLatLng } from './meta';
import type { Stop } from './types';

/**
 * The organizer's description of an event (event.json, never committed:
 * it holds real home addresses). Used by `pnpm event:create` and, in
 * development only, to show the real route in the demo.
 */
export interface EventFile {
  readonly name: string;
  readonly stops: readonly { readonly name: string; readonly lat: number; readonly lng: number }[];
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

export const parseEventFile = (value: unknown): EventFile | null =>
  isRecord(value) &&
  typeof value['name'] === 'string' &&
  value['name'].trim() !== '' &&
  Array.isArray(value['stops']) &&
  value['stops'].every(
    (stop: unknown) => isRecord(stop) && typeof stop['name'] === 'string' && isLatLng(stop),
  )
    ? (value as unknown as EventFile)
    : null;

export const slugify = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Stops in the order they appear in the file. */
export const stopsOf = (event: EventFile): readonly Stop[] =>
  event.stops.map((stop, index) => ({
    kind: 'stop',
    id: `stop-${index + 1}-${slugify(stop.name)}`.slice(0, 64),
    name: stop.name.trim(),
    order: index + 1,
    position: { lat: stop.lat, lng: stop.lng },
  }));
