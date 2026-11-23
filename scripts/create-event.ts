/**
 * Creates (or extends) a private event and prints its invite link + QR code.
 *
 *   pnpm event:create event.json                          # new event
 *   pnpm event:create more.json --keys out/x.keys.json    # add stops to it
 *
 * The organizer's signing key and the group secret are written to
 * out/<event>.keys.json (mode 600). Keep that file offline: whoever holds it
 * can add stops in your name and read every photo.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import QRCode from 'qrcode';

import { createCloudinaryClient } from '../src/lib/cloudinary';
import { parseCloudinaryConfig } from '../src/lib/config';
import { deriveEventKeys, generateSecret, SECRET_BYTES } from '../src/lib/crypto';
import { fromBase64Url, safeJsonParse, toBase64Url } from '../src/lib/encoding';
import { fingerprintOf, generateIdentity } from '../src/lib/identity';
import { buildInviteUrl } from '../src/lib/invite';
import { isLatLng } from '../src/lib/meta';
import { publishEntry } from '../src/lib/repository';
import type { Bytes, Entry, Stop } from '../src/lib/types';

interface EventFile {
  readonly name: string;
  readonly stops: readonly { readonly name: string; readonly lat: number; readonly lng: number }[];
}

interface Organizer {
  readonly secret: Bytes;
  readonly publicKey: string;
  readonly privateKey: CryptoKey;
}

const SIGNING = { name: 'ECDSA', namedCurve: 'P-256' } as const;

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

const toEntries = (event: EventFile, organizerKey: string): readonly Entry[] => [
  { meta: { kind: 'event', name: event.name.trim(), organizerKey }, payload: new Uint8Array(0) },
  ...event.stops.map((stop, index): Entry<Stop> => ({
    meta: {
      kind: 'stop',
      id: `stop-${index + 1}-${slugify(stop.name)}`.slice(0, 64),
      name: stop.name.trim(),
      order: index + 1,
      position: { lat: stop.lat, lng: stop.lng },
    },
    payload: new Uint8Array(0),
  })),
];

const newOrganizer = async (): Promise<Organizer> => {
  const identity = await generateIdentity(true);
  return { secret: generateSecret(), ...identity };
};

const loadOrganizer = async (path: string): Promise<Organizer> => {
  const saved = safeJsonParse(await readFile(path, 'utf8'));
  if (!isRecord(saved) || typeof saved['secret'] !== 'string' || !isRecord(saved['privateKey'])) {
    return fail(`${path} is not a keys file written by this script`);
  }
  const secret = fromBase64Url(saved['secret']);
  const publicKey = saved['publicKey'];
  if (secret?.length !== SECRET_BYTES || typeof publicKey !== 'string') {
    return fail(`${path} is corrupted`);
  }
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    saved['privateKey'] as JsonWebKey,
    SIGNING,
    false,
    ['sign'],
  );
  return { secret, publicKey, privateKey };
};

const saveOrganizer = async (path: string, organizer: Organizer): Promise<void> => {
  const privateKey = await crypto.subtle.exportKey('jwk', organizer.privateKey);
  const contents = JSON.stringify(
    { secret: toBase64Url(organizer.secret), publicKey: organizer.publicKey, privateKey },
    null,
    2,
  );
  await writeFile(path, `${contents}\n`, { mode: 0o600, flag: 'wx' });
};

const main = async (): Promise<void> => {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the real environment.
  }

  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { keys: { type: 'string' }, url: { type: 'string' } },
  });

  const file = positionals[0] ?? fail('Usage: pnpm event:create <event.json> [--keys file]');
  const event = safeJsonParse(await readFile(file, 'utf8'));
  if (!isEventFile(event)) {
    return fail(`${file} must look like event.example.json`);
  }

  const cloudinary =
    parseCloudinaryConfig(process.env) ??
    fail('Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET (see .env.example)');
  const appUrl = values.url ?? process.env['APP_URL'] ?? fail('Set APP_URL or pass --url');

  const organizer =
    values.keys === undefined ? await newOrganizer() : await loadOrganizer(values.keys);
  const organizerId =
    (await fingerprintOf(organizer.publicKey)) ?? fail('Invalid organizer public key');
  const keys = await deriveEventKeys(organizer.secret, organizerId);
  const client = createCloudinaryClient(cloudinary);

  const outDir = 'out';
  const slug = slugify(event.name);
  await mkdir(outDir, { recursive: true });
  if (values.keys === undefined) {
    // Written before uploading anything, so a crash never leaves an orphan event.
    await saveOrganizer(join(outDir, `${slug}.keys.json`), organizer);
  }

  await toEntries(event, organizer.publicKey).reduce(async (previous, entry) => {
    await previous;
    await publishEntry(client, keys, entry, organizer.privateKey);
    console.log(`✔ ${entry.meta.kind === 'stop' ? entry.meta.name : 'event info'} (signed)`);
  }, Promise.resolve());

  const invite = buildInviteUrl(appUrl, { secret: organizer.secret, organizer: organizerId });
  const qrPath = join(outDir, `${slug}-invite.svg`);
  await writeFile(qrPath, await QRCode.toString(invite, { type: 'svg', margin: 2 }));

  console.log(`\nInvite link (share only with the group):\n${invite}\n`);
  console.log(`QR code:          ${qrPath}`);
  console.log(`Organizer keys:   ${join(outDir, `${slug}.keys.json`)} (keep it offline)`);
};

await main();
