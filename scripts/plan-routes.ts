/**
 * Adds real paths to the itinerary of event.json and writes it back as `legs`.
 *
 *   pnpm event:route event.json                       # OpenStreetMap: free, no key
 *   pnpm event:route event.json --provider google [--departure 2026-12-12T18:00]
 *
 * OpenStreetMap (default): keeps the options you typed (metro lines and
 * stations, walk, bike) and draws them for real: the metro along the track
 * between your stations, the walks and rides along the streets (FOSSGIS
 * OSRM). Google: plans everything itself; needs GOOGLE_MAPS_API_KEY in .env.
 *
 * Runs on the organizer's computer only: the app never contacts either.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { safeJsonParse } from '../src/lib/encoding';
import { parseEventFile } from '../src/lib/event-file';
import { parseBbox } from '../src/lib/map-area';
import { METRO_FILE, type MetroMap, parseMetroFile } from '../src/lib/metro';
import { osrmUrl, parseOsrm, planLegOsm, type StreetRouter } from '../src/lib/plan-osm';
import {
  parseRoutesResponse,
  type RequestedMode,
  ROUTES_ENDPOINT,
  ROUTES_FIELD_MASK,
  routesRequest,
} from '../src/lib/routes';
import type { LatLng, Leg, LegOption } from '../src/lib/types';
import { fetchMetro } from './overpass';

const MODES: readonly RequestedMode[] = ['transit', 'walk', 'bike'];

const fail = (message: string): never => {
  console.error(`✖ ${message}`);
  process.exit(1);
};

const plan = async (
  key: string,
  from: LatLng,
  to: LatLng,
  mode: RequestedMode,
  departure: Date | null,
): Promise<LegOption | null> => {
  const response = await fetch(ROUTES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': ROUTES_FIELD_MASK,
    },
    body: JSON.stringify(routesRequest(from, to, mode, departure)),
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    return fail(`Routes API ${mode}: ${response.status} ${JSON.stringify(json).slice(0, 300)}`);
  }
  return parseRoutesResponse(json, mode);
};

const describe = (option: LegOption): string =>
  option.steps.length > 0
    ? `${option.steps.map(({ line }) => line).join('→')} ${option.minutes}′`
    : `${option.mode} ${option.minutes}′`;

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** FOSSGIS asks for at most one request per second and an identifying agent. */
const osrmRouter: StreetRouter = async (profile, from, to) => {
  await pause(1100);
  const response = await fetch(osrmUrl(profile, from, to), {
    headers: { 'User-Agent': 'pis-stop (https://github.com/MarcLlobet/pis-stop)' },
  });
  return response.ok ? parseOsrm(await response.json()) : null;
};

/** The committed metro.json if present, otherwise straight from OpenStreetMap. */
const loadMetro = async (stops: readonly LatLng[]): Promise<MetroMap> => {
  const saved = await readFile(`public/${METRO_FILE}`, 'utf8').then(
    (text) => parseMetroFile(safeJsonParse(text)),
    () => null,
  );
  if (saved !== null) {
    return saved;
  }
  const margin = 0.02;
  const bbox = parseBbox(
    [
      Math.min(...stops.map(({ lng }) => lng)) - margin,
      Math.min(...stops.map(({ lat }) => lat)) - margin,
      Math.max(...stops.map(({ lng }) => lng)) + margin,
      Math.max(...stops.map(({ lat }) => lat)) + margin,
    ]
      .map((value) => value.toFixed(5))
      .join(','),
  );
  return bbox === null ? { lines: [] } : fetchMetro(bbox);
};

const DEFAULT_OPTIONS: Leg['options'] = [
  { mode: 'walk', minutes: 0, steps: [], segments: [] },
  { mode: 'bike', minutes: 0, steps: [], segments: [] },
];

const planWithGoogle = async (
  pairs: readonly { readonly from: Named; readonly to: Named }[],
  departure: Date | null,
): Promise<readonly Leg[]> => {
  const key = process.env['GOOGLE_MAPS_API_KEY'] ?? fail('Set GOOGLE_MAPS_API_KEY in .env');
  return Promise.all(
    pairs.map(async ({ from, to }) => {
      const options = await Promise.all(MODES.map((mode) => plan(key, from, to, mode, departure)));
      const found = options.filter((option): option is LegOption => option !== null);
      console.log(`✔ ${from.name} → ${to.name}: ${found.map(describe).join(' · ')}`);
      return { options: found, path: [] };
    }),
  );
};

const planWithOsm = async (
  pairs: readonly { readonly from: Named; readonly to: Named }[],
  typed: readonly Leg[],
): Promise<readonly Leg[]> => {
  const metro = await loadMetro(pairs.flatMap(({ from, to }) => [from, to]));
  console.log(`Metro lines: ${metro.lines.map(({ ref }) => ref).join(', ') || 'none'}`);
  // Sequential on purpose: the public router allows one request per second.
  return pairs.reduce<Promise<readonly Leg[]>>(async (previous, { from, to }, index) => {
    const done = await previous;
    const leg = typed[index] ?? { options: DEFAULT_OPTIONS, path: [] };
    const planned = await planLegOsm(leg, from, to, metro, osrmRouter);
    const unplanned = planned.options.filter(({ segments }) => segments.length === 0);
    const notFound =
      unplanned.length === 0 ? '' : ` (not found: ${unplanned.map(describe).join(', ')})`;
    console.log(
      `${unplanned.length === 0 ? '✔' : '△'} ${from.name} → ${to.name}: ${planned.options.map(describe).join(' · ')}${notFound}`,
    );
    return [...done, planned];
  }, Promise.resolve([]));
};

interface Named extends LatLng {
  readonly name: string;
}

const main = async (): Promise<void> => {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the real environment.
  }
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { departure: { type: 'string' }, provider: { type: 'string', default: 'osm' } },
  });
  const file =
    positionals[0] ?? fail('Usage: pnpm event:route <event.json> [--provider osm|google]');
  const departure = values.departure === undefined ? null : new Date(values.departure);
  if (departure !== null && Number.isNaN(departure.getTime())) {
    fail('--departure must be a date like 2026-12-12T18:00');
  }
  if (values.provider !== 'osm' && values.provider !== 'google') {
    fail('--provider must be osm or google');
  }

  const raw = safeJsonParse(await readFile(file, 'utf8'));
  const event = parseEventFile(raw) ?? fail(`${file} must look like event.example.json`);
  const pairs = event.stops.slice(1).map((to, index) => ({ from: event.stops[index] ?? to, to }));

  const legs =
    values.provider === 'google'
      ? await planWithGoogle(pairs, departure)
      : await planWithOsm(pairs, event.legs);

  const updated = { ...(raw as Readonly<Record<string, unknown>>), legs };
  if (parseEventFile(updated) === null) {
    fail('The planned itinerary did not pass validation; event.json was not changed');
  }
  await writeFile(file, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`\nItinerary written to ${file}. Check it with pnpm dev, then pnpm event:create.`);
};

await main();
