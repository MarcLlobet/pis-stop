/**
 * Downloads the metro lines of the event area from OpenStreetMap into
 * public/map/metro.json, so the map can draw the network (public data).
 *
 *   pnpm map:metro [--bbox west,south,east,north]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import { DEFAULT_BBOX, parseBbox } from '../src/lib/map-area';
import { METRO_FILE } from '../src/lib/metro';
import { fetchMetro } from './overpass';

const fail = (message: string): never => {
  console.error(`✖ ${message}`);
  process.exit(1);
};

const main = async (): Promise<void> => {
  const { values } = parseArgs({ options: { bbox: { type: 'string' } } });
  const text = values.bbox ?? process.env['MAP_BBOX'] ?? DEFAULT_BBOX;
  const bbox = parseBbox(text) ?? fail(`Invalid bbox "${text}" (west,south,east,north)`);
  const metro = await fetchMetro(bbox);
  if (metro.lines.length === 0) {
    fail('No metro lines found in that area');
  }
  const output = join('public', METRO_FILE);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(metro)}\n`);
  console.log(`✔ ${output}: ${metro.lines.map(({ ref }) => ref).join(', ')}`);
};

await main();
