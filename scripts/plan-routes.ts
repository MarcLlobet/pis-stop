/**
 * Plans the real itinerary between consecutive stops of event.json with the
 * Google Routes API, and writes it back into the file as `legs`:
 *
 *   pnpm event:route event.json [--departure 2026-12-12T18:00]
 *
 * Each leg gets up to three options (transit, walking, cycling), with real
 * paths, stations, line colours and times. Runs on the organizer's computer
 * only: the app never contacts Google. Needs GOOGLE_MAPS_API_KEY in .env
 * (a secret: it is never bundled), with the Routes API enabled.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { safeJsonParse } from '../src/lib/encoding';
import { parseEventFile } from '../src/lib/event-file';
import {
  parseRoutesResponse,
  type RequestedMode,
  ROUTES_ENDPOINT,
  ROUTES_FIELD_MASK,
  routesRequest,
} from '../src/lib/routes';
import type { LatLng, Leg, LegOption } from '../src/lib/types';

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

const main = async (): Promise<void> => {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the real environment.
  }
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { departure: { type: 'string' } },
  });
  const file = positionals[0] ?? fail('Usage: pnpm event:route <event.json> [--departure ISO]');
  const key = process.env['GOOGLE_MAPS_API_KEY'] ?? fail('Set GOOGLE_MAPS_API_KEY in .env');
  const departure = values.departure === undefined ? null : new Date(values.departure);
  if (departure !== null && Number.isNaN(departure.getTime())) {
    fail('--departure must be a date like 2026-12-12T18:00');
  }

  const raw = safeJsonParse(await readFile(file, 'utf8'));
  const event = parseEventFile(raw) ?? fail(`${file} must look like event.example.json`);
  const pairs = event.stops.slice(1).map((to, index) => ({ from: event.stops[index] ?? to, to }));

  const legs: readonly Leg[] = await Promise.all(
    pairs.map(async ({ from, to }) => {
      const options = await Promise.all(MODES.map((mode) => plan(key, from, to, mode, departure)));
      const found = options.filter((option): option is LegOption => option !== null);
      console.log(`✔ ${from.name} → ${to.name}: ${found.map(describe).join(' · ')}`);
      return { options: found, path: [] };
    }),
  );

  const updated = { ...(raw as Readonly<Record<string, unknown>>), legs };
  if (parseEventFile(updated) === null) {
    fail('The planned itinerary did not pass validation; event.json was not changed');
  }
  await writeFile(file, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`\nItinerary written to ${file}. Check it with pnpm dev, then pnpm event:create.`);
};

await main();
