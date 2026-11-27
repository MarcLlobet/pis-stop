/**
 * Creates (or extends) a private event and prints its invite link + QR code.
 *
 *   pnpm event:create event.json                          # new event
 *   pnpm event:create more.json --keys out/x.keys.json    # add stops to it
 *
 * The organizer's signing key and the group secret are written to
 * out/<event>.keys.json (mode 600). Keep that file offline: whoever holds it
 * can add stops in your name and read every photo.
 *
 * With CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env, the event also
 * gets its own upload preset, so `pnpm event:close` can close it alone.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import QRCode from 'qrcode';

import { createCloudinaryClient } from '../src/lib/cloudinary';
import {
  type AdminCredentials,
  createPresetRequest,
  parseAdminCredentials,
  presetName,
} from '../src/lib/cloudinary-admin';
import { parseCloudinaryConfig } from '../src/lib/config';
import { deriveEventKeys, generateSecret } from '../src/lib/crypto';
import { safeJsonParse, toBase64Url } from '../src/lib/encoding';
import { eventEntries, parseEventFile, slugify } from '../src/lib/event-file';
import { fingerprintOf, generateIdentity } from '../src/lib/identity';
import { buildInviteUrl } from '../src/lib/invite';
import { publishEntry } from '../src/lib/repository';
import { fail, loadOrganizer, type Organizer } from './organizer';

const createPreset = async (credentials: AdminCredentials): Promise<string> => {
  const name = presetName(crypto.getRandomValues(new Uint8Array(16)));
  const { url, init } = createPresetRequest(credentials, name);
  const response = await fetch(url, init);
  if (!response.ok) {
    return fail(`Cloudinary refused to create the upload preset (${String(response.status)})`);
  }
  return name;
};

const newOrganizer = async (credentials: AdminCredentials | null): Promise<Organizer> => {
  const identity = await generateIdentity(true);
  if (credentials === null) {
    console.warn(
      '⚠ No CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET: this event uses the shared upload preset,\n' +
        '  so closing it (deleting that preset) closes every event that shares it.',
    );
  }
  return {
    secret: generateSecret(),
    ...identity,
    uploadPreset: credentials === null ? null : await createPreset(credentials),
  };
};

const saveOrganizer = async (path: string, organizer: Organizer): Promise<void> => {
  const privateKey = await crypto.subtle.exportKey('jwk', organizer.privateKey);
  const contents = JSON.stringify(
    {
      secret: toBase64Url(organizer.secret),
      publicKey: organizer.publicKey,
      privateKey,
      uploadPreset: organizer.uploadPreset,
    },
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
  const event =
    parseEventFile(safeJsonParse(await readFile(file, 'utf8'))) ??
    fail(`${file} must look like event.example.json`);

  const cloudinary =
    parseCloudinaryConfig(process.env) ??
    fail('Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET (see .env.example)');
  const appUrl = values.url ?? process.env['APP_URL'] ?? fail('Set APP_URL or pass --url');

  const organizer =
    values.keys === undefined
      ? await newOrganizer(parseAdminCredentials(process.env))
      : await loadOrganizer(values.keys);
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

  await eventEntries(event, organizer.publicKey, organizer.uploadPreset).reduce(
    async (previous, entry) => {
      await previous;
      await publishEntry(
        client,
        keys,
        entry,
        organizer.privateKey,
        organizer.uploadPreset ?? undefined,
      );
      console.log(`✔ ${entry.meta.kind === 'stop' ? entry.meta.name : 'event info'} (signed)`);
    },
    Promise.resolve(),
  );

  const invite = buildInviteUrl(appUrl, { secret: organizer.secret, organizer: organizerId });
  const qrPath = join(outDir, `${slug}-invite.svg`);
  await writeFile(qrPath, await QRCode.toString(invite, { type: 'svg', margin: 2 }));

  console.log(`\nInvite link (share only with the group):\n${invite}\n`);
  console.log(`QR code:          ${qrPath}`);
  console.log(`Organizer keys:   ${join(outDir, `${slug}.keys.json`)} (keep it offline)`);
  console.log(
    organizer.uploadPreset === null
      ? 'Upload preset:    the shared default'
      : `Upload preset:    ${organizer.uploadPreset} (close with pnpm event:close --keys …)`,
  );
};

await main();
