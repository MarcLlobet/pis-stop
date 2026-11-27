import { isLatLng, parseLegs } from './meta';
import type { Entry, Leg, Stop } from './types';

/**
 * The organizer's description of an event (event.json, never committed:
 * it holds real home addresses). Used by `pnpm event:create` and, in
 * development only, to show the real route in the demo.
 */
export interface EventFile {
  readonly name: string;
  readonly stops: readonly { readonly name: string; readonly lat: number; readonly lng: number }[];
  /** Optional itinerary: leg N goes from stop N to stop N + 1 (see docs/PROTOCOL.md). */
  readonly legs: readonly Leg[];
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

export const parseEventFile = (value: unknown): EventFile | null => {
  if (
    !isRecord(value) ||
    typeof value['name'] !== 'string' ||
    value['name'].trim() === '' ||
    !Array.isArray(value['stops'])
  ) {
    return null;
  }
  const stops = value['stops'].flatMap((stop: unknown): EventFile['stops'] =>
    isRecord(stop) && typeof stop['name'] === 'string' && isLatLng(stop)
      ? [{ name: stop['name'], lat: stop.lat, lng: stop.lng }]
      : [],
  );
  const legs = parseLegs(value['legs']);
  return stops.length === value['stops'].length && legs !== null && legs.length < stops.length + 1
    ? { name: value['name'], stops, legs }
    : null;
};

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

/**
 * What the organizer publishes for an event: its info (name, key, itinerary,
 * own upload preset) and its stops, to be signed with the organizer key.
 */
export const eventEntries = (
  event: EventFile,
  organizerKey: string,
  uploadPreset: string | null,
): readonly Entry[] => [
  {
    meta: {
      kind: 'event',
      name: event.name.trim(),
      organizerKey,
      legs: event.legs,
      ...(uploadPreset === null ? {} : { uploadPreset }),
    },
    payload: new Uint8Array(0),
  },
  ...stopsOf(event).map((meta): Entry => ({ meta, payload: new Uint8Array(0) })),
];
