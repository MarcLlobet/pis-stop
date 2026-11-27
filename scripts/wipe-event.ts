/**
 * Deletes what was uploaded to an event, so you can start clean.
 *
 *   pnpm event:wipe --keys out/<event>.keys.json --votes            # preview only
 *   pnpm event:wipe --keys out/<event>.keys.json --votes --photos --yes
 *
 *   --votes   every vote and every open/close of the voting
 *   --photos  every photo, thumbnail and full size
 *
 * Without --yes it only counts what it would delete. It never touches the
 * event, its stops, the profiles or who may host: people stay joined.
 *
 * Needs CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env (Cloudinary →
 * Settings → API Keys). Deleting cannot be undone.
 */
import { parseArgs } from 'node:util';

import { createCloudinaryClient } from '../src/lib/cloudinary';
import {
  DELETE_BATCH,
  deleteFilesRequest,
  parseAdminCredentials,
  publicIdFromUrl,
} from '../src/lib/cloudinary-admin';
import { parseCloudinaryConfig } from '../src/lib/config';
import { deriveEventKeys, ENTRY, open } from '../src/lib/crypto';
import { fingerprintOf } from '../src/lib/identity';
import { unpackSigned } from '../src/lib/pack';
import { MAX_ENTRY_BYTES } from '../src/lib/repository';
import type { SignedEntry } from '../src/lib/types';
import { verifyEntries } from '../src/lib/verify';
import { fail, loadOrganizer } from './organizer';

const chunks = <T>(items: readonly T[], size: number): readonly (readonly T[])[] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

const main = async (): Promise<void> => {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the real environment.
  }
  const { values } = parseArgs({
    options: {
      keys: { type: 'string' },
      votes: { type: 'boolean' },
      photos: { type: 'boolean' },
      yes: { type: 'boolean' },
    },
  });
  const path =
    values.keys ??
    fail('Usage: pnpm event:wipe --keys out/<event>.keys.json [--votes] [--photos] [--yes]');
  if (values.votes !== true && values.photos !== true) {
    return fail('Say what to delete: --votes, --photos, or both.');
  }

  const organizer = await loadOrganizer(path);
  const organizerId =
    (await fingerprintOf(organizer.publicKey)) ?? fail('Invalid organizer public key');
  const keys = await deriveEventKeys(organizer.secret, organizerId);
  const cloudinary =
    parseCloudinaryConfig(process.env) ??
    fail('Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET (see .env.example)');
  const client = createCloudinaryClient(cloudinary);

  const urls = await client.list(keys.tag);
  const read = await Promise.all(
    urls.map(async (url) => {
      // One unreadable file must not stop the rest from being cleaned up.
      const plain = await client
        .download(url, MAX_ENTRY_BYTES)
        .then((bytes) => open(keys.aes, bytes, ENTRY))
        .catch(() => null);
      const entry: SignedEntry | null = plain && unpackSigned(plain);
      return { url, entry };
    }),
  );

  const entryFiles = read.flatMap(({ url, entry }) => {
    const kind = entry?.meta.kind;
    const wanted =
      (values.votes === true && (kind === 'rating' || kind === 'round')) ||
      (values.photos === true && kind === 'photo');
    return wanted ? [url] : [];
  });
  // Full-size photos hang off signed photo entries; only trust verified ones,
  // so a forged entry cannot point this script at someone else's file.
  const verified =
    values.photos === true
      ? await verifyEntries(
          read.flatMap(({ entry }) => (entry === null ? [] : [entry])),
          organizerId,
        )
      : [];
  const fullFiles = verified.flatMap(({ meta }) =>
    meta.kind === 'photo' && client.owns(meta.fullUrl) ? [meta.fullUrl] : [],
  );

  const publicIds = [...new Set([...entryFiles, ...fullFiles])].flatMap((url) => {
    const id = publicIdFromUrl(cloudinary.cloudName, url);
    return id === null ? [] : [id];
  });

  console.log(
    `${values.yes === true ? 'Deleting' : 'Would delete'} ${String(publicIds.length)} files ` +
      `(${String(entryFiles.length)} entries, ${String(fullFiles.length)} full-size photos).`,
  );
  if (values.yes !== true) {
    console.log('Preview only. Add --yes to delete them. This cannot be undone.');
    return;
  }
  if (publicIds.length === 0) {
    return;
  }

  const credentials =
    parseAdminCredentials(process.env) ??
    fail('Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET (see .env.example)');
  await chunks(publicIds, DELETE_BATCH).reduce(async (previous, batch) => {
    await previous;
    const { url, init } = deleteFilesRequest(credentials, batch);
    const response = await fetch(url, init);
    if (!response.ok) {
      fail(`Cloudinary refused to delete (${String(response.status)})`);
    }
    console.log(`✔ deleted ${String(batch.length)}`);
  }, Promise.resolve());
  console.log('Done. Reload the app; the CDN may take a minute to forget them.');
};

await main();
