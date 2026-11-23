/**
 * Downloads the map for the event area into public/map/area.pmtiles.
 *
 *   pnpm map:extract                         # Barcelona
 *   pnpm map:extract --bbox 2.1,41.37,2.2,41.42
 *
 * Uses the `pmtiles` CLI if it is installed (`brew install pmtiles`), or
 * `go run` at a pinned version otherwise (Go verifies the module checksum).
 * Only the tiles inside the box are downloaded (HTTP range requests).
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseArgs, promisify } from 'node:util';

import {
  buildUrl,
  DEFAULT_BBOX,
  formatBbox,
  MAP_FILE,
  MAX_DATA_ZOOM,
  parseBbox,
  recentBuilds,
} from '../src/lib/map-area';

const run = promisify(execFile);
const PMTILES_MODULE = 'github.com/protomaps/go-pmtiles@v1.31.2';
const OUTPUT = join('public', MAP_FILE);

const fail = (message: string): never => {
  console.error(`✖ ${message}`);
  process.exit(1);
};

const hasCommand = async (command: string): Promise<boolean> =>
  run(command, ['version']).then(
    () => true,
    () => false,
  );

/** The newest daily build that exists. Old builds are deleted after a while. */
const findBuild = async (): Promise<string> => {
  const candidates = recentBuilds(new Date(), 10);
  const available = await Promise.all(
    candidates.map(async (build) => {
      const response = await fetch(buildUrl(build), { method: 'HEAD' }).catch(() => null);
      return response?.ok === true;
    }),
  );
  return candidates.find((_, index) => available[index]) ?? fail('No recent Protomaps build found');
};

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: { bbox: { type: 'string' }, build: { type: 'string' } },
  });
  const bboxText = values.bbox ?? process.env['MAP_BBOX'] ?? DEFAULT_BBOX;
  const bbox = parseBbox(bboxText) ?? fail(`Invalid bbox "${bboxText}" (west,south,east,north)`);
  const build =
    values.build === undefined
      ? await findBuild()
      : /^\d{8}$/.test(values.build)
        ? values.build
        : fail('--build must look like YYYYMMDD');

  const args = [
    'extract',
    buildUrl(build),
    OUTPUT,
    `--bbox=${formatBbox(bbox)}`,
    `--maxzoom=${MAX_DATA_ZOOM}`,
  ];
  const [command, prefix] = (await hasCommand('pmtiles'))
    ? ['pmtiles', []]
    : ['go', ['run', PMTILES_MODULE]];

  console.log(`Extracting ${formatBbox(bbox)} from build ${build}…`);
  await mkdir(dirname(OUTPUT), { recursive: true });
  await run(command, [...prefix, ...args], { maxBuffer: 16 * 1024 * 1024 }).catch(
    (error: unknown) => fail(`pmtiles failed: ${String(error)}`),
  );

  const file = await readFile(OUTPUT);
  const digest = createHash('sha256').update(file).digest('hex');
  console.log(`✔ ${OUTPUT}: ${(file.length / 1024 / 1024).toFixed(1)} MB, sha256 ${digest}`);
  console.log(`  Build ${build}. Commit it: git add ${OUTPUT}`);
};

await main();
