/**
 * Creates (or extends) a private event and prints its invite link + QR code.
 *
 *   npm run event:create -- event.json
 *   npm run event:create -- event.json --secret <base64url>   # add stops to an existing event
 *
 * The stop list is encrypted and uploaded like any other entry, so the
 * addresses never appear in the repository or in the public bundle.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import QRCode from 'qrcode';

import { createCloudinaryClient } from '../src/lib/cloudinary';
import { parseCloudinaryConfig } from '../src/lib/config';
import { deriveEventKeys, generateSecret, SECRET_BYTES } from '../src/lib/crypto';
import { fromBase64Url, safeJsonParse } from '../src/lib/encoding';
import { buildInviteUrl } from '../src/lib/invite';
import { isLatLng } from '../src/lib/meta';
import { publishEntry } from '../src/lib/repository';
import type { Bytes, Entry, EventInfo, Stop } from '../src/lib/types';

interface EventFile {
  readonly name: string;
  readonly stops: readonly { readonly name: string; readonly lat: number; readonly lng: number }[];
}

const fail = (message: string): never => {
  console.error(`✖ ${message}`);
  process.exit(1);
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

const isEventFile = (value: unknown): value is EventFile =>
  isRecord(value) &&
  typeof value['name'] === 'string' &&
  value['name'].trim() !== '' &&
  Array.isArray(value['stops']) &&
  value['stops'].every(
    (stop: unknown) => isRecord(stop) && typeof stop['name'] === 'string' && isLatLng(stop),
  );

const slugify = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const toEntries = (event: EventFile): readonly Entry[] => [
  {
    meta: { kind: 'event', name: event.name.trim() } satisfies EventInfo,
    payload: new Uint8Array(0),
  },
  ...event.stops.map(
    (stop, index): Entry<Stop> => ({
      meta: {
        kind: 'stop',
        id: `stop-${index + 1}-${slugify(stop.name)}`,
        name: stop.name.trim(),
        order: index + 1,
        position: { lat: stop.lat, lng: stop.lng },
      },
      payload: new Uint8Array(0),
    }),
  ),
];

const readSecretArg = (value: string | undefined): Bytes => {
  if (value === undefined) {
    return generateSecret();
  }
  const secret = fromBase64Url(value);
  return secret?.length === SECRET_BYTES ? secret : fail('--secret is not a valid event secret');
};

const main = async (): Promise<void> => {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the real environment.
  }

  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { secret: { type: 'string' }, url: { type: 'string' } },
  });

  const file = positionals[0] ?? fail('Usage: npm run event:create -- <event.json>');
  const event = safeJsonParse(await readFile(file, 'utf8'));
  if (!isEventFile(event)) {
    return fail(`${file} must look like event.example.json`);
  }

  const cloudinary =
    parseCloudinaryConfig(process.env) ??
    fail('Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET (see .env.example)');
  const appUrl = values.url ?? process.env['APP_URL'] ?? fail('Set APP_URL or pass --url');

  const secret = readSecretArg(values.secret);
  const keys = await deriveEventKeys(secret);
  const client = createCloudinaryClient(cloudinary);

  await toEntries(event).reduce(async (previous, entry) => {
    await previous;
    await publishEntry(client, keys, entry);
    console.log(`✔ ${entry.meta.kind === 'stop' ? entry.meta.name : 'event info'}`);
  }, Promise.resolve());

  const invite = buildInviteUrl(appUrl, secret);
  const outDir = 'out';
  const qrPath = join(outDir, `${slugify(event.name)}-invite.svg`);
  await mkdir(outDir, { recursive: true });
  await writeFile(qrPath, await QRCode.toString(invite, { type: 'svg', margin: 2 }));

  console.log(`\nInvite link (share only with the group):\n${invite}\n`);
  console.log(`QR code: ${qrPath}`);
  console.log('Keep this link safe: it is the only key to the photos.');
};

await main();
