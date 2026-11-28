/**
 * Takes every photo of an event home: downloads, decrypts and verifies them,
 * and saves them as plain JPEGs with who took them, when and where.
 *
 *   pnpm event:export --keys out/<event>.keys.json [--out <folder>]
 *
 * Only photos signed by a member are exported, and only if the full-size
 * image matches the hash its author signed. Running it again only adds the
 * photos that are not in the folder yet. Needs only the public Cloudinary
 * settings of .env: no API key.
 *
 * The folder holds the photos IN THE CLEAR. Keep it as private as the keys file.
 */
import { mkdir, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { createCloudinaryClient } from '../src/lib/cloudinary';
import { parseCloudinaryConfig } from '../src/lib/config';
import { deriveEventKeys } from '../src/lib/crypto';
import { slugify } from '../src/lib/event-file';
import { collectPhotos, EXPORT_DEPS } from '../src/lib/export';
import { fingerprintOf } from '../src/lib/identity';
import { createCloudinaryRepository } from '../src/lib/repository';
import { fail, loadOrganizer } from './organizer';

const isFileExists = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'EEXIST';

const main = async (): Promise<void> => {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the real environment.
  }
  const { values } = parseArgs({ options: { keys: { type: 'string' }, out: { type: 'string' } } });
  const path = values.keys ?? fail('Usage: pnpm event:export --keys out/<event>.keys.json');

  const organizer = await loadOrganizer(path);
  const organizerId =
    (await fingerprintOf(organizer.publicKey)) ?? fail('Invalid organizer public key');
  const keys = await deriveEventKeys(organizer.secret, organizerId);
  const cloudinary =
    parseCloudinaryConfig(process.env) ??
    fail('Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET (see .env.example)');
  const repository = createCloudinaryRepository(
    createCloudinaryClient(cloudinary),
    keys,
    EXPORT_DEPS,
  );

  const snapshot = await repository.load();
  const name = snapshot.eventName ?? 'event';
  const folder = values.out ?? join('out', `${slugify(name) || 'event'}-fotos`);
  console.log(`${name}: ${String(snapshot.photos.length)} photos → ${folder}`);
  await mkdir(folder, { recursive: true, mode: 0o700 });

  const { exported, failed } = await collectPhotos(repository, snapshot, (done, total) => {
    process.stdout.write(`\r  ${String(done)}/${String(total)}`);
  });
  process.stdout.write('\n');

  const written = await Promise.all(
    exported.map(async (photo) => {
      const file = join(folder, photo.fileName);
      try {
        // 'wx': never overwrite, so a second run only adds new photos.
        await writeFile(file, photo.bytes, { flag: 'wx', mode: 0o600 });
      } catch (error) {
        if (isFileExists(error)) {
          return false;
        }
        throw error;
      }
      // Photo apps sort by file date: make it the moment the photo was taken.
      const takenAt = new Date(photo.takenAt);
      await utimes(file, takenAt, takenAt);
      return true;
    }),
  );

  const index = exported.map(({ fileName, author, takenAt, position }) => ({
    file: fileName,
    author,
    takenAt,
    position,
  }));
  await writeFile(join(folder, 'fotos.json'), `${JSON.stringify(index, null, 2)}\n`, {
    mode: 0o600,
  });

  const added = written.filter(Boolean).length;
  console.log(
    `✔ ${String(added)} new, ${String(exported.length - added)} already there, ` +
      `${String(failed.length)} failed. Index: ${join(folder, 'fotos.json')}`,
  );
  if (failed.length > 0) {
    console.warn(
      '⚠ Photos that failed are missing on Cloudinary or did not match the hash their\n' +
        '  author signed (altered or corrupt). They are left out on purpose.',
    );
  }
};

await main();
