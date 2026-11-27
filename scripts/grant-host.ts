/**
 * Names who may open and close the voting from their phone.
 *
 *   pnpm event:host --keys out/<event>.keys.json            # lists who has joined
 *   pnpm event:host --keys out/<event>.keys.json <name|id>  # grants it
 *
 * Whoever joined first has to make their profile in the app before this can
 * find them. The organizer key never leaves this computer: this only signs a
 * small note saying "this profile may run the voting".
 */
import { parseArgs } from 'node:util';

import { createCloudinaryClient } from '../src/lib/cloudinary';
import { parseCloudinaryConfig } from '../src/lib/config';
import { deriveEventKeys } from '../src/lib/crypto';
import { fingerprintOf } from '../src/lib/identity';
import { createCloudinaryRepository, publishEntry } from '../src/lib/repository';
import { fail, loadOrganizer } from './organizer';

const main = async (): Promise<void> => {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the real environment.
  }

  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { keys: { type: 'string' } },
  });
  const path =
    values.keys ?? fail('Usage: pnpm event:host --keys out/<event>.keys.json [name or id]');
  const organizer = await loadOrganizer(path);
  const organizerId =
    (await fingerprintOf(organizer.publicKey)) ?? fail('Invalid organizer public key');
  const keys = await deriveEventKeys(organizer.secret, organizerId);
  const cloudinary =
    parseCloudinaryConfig(process.env) ??
    fail('Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET (see .env.example)');
  const client = createCloudinaryClient(cloudinary);
  const repository = createCloudinaryRepository(client, keys, {
    toUrl: () => '',
    newId: () => crypto.randomUUID(),
    now: () => new Date(),
  });

  const snapshot = await repository.load();
  const people = [...snapshot.profiles.values()];
  const wanted = positionals[0];
  if (wanted === undefined) {
    console.log(people.length === 0 ? 'Nobody has joined yet.' : 'Joined so far:\n');
    people.forEach(({ id, name }) => {
      console.log(`  ${snapshot.hosts.has(id) ? '★' : ' '} ${name}  (${id})`);
    });
    console.log('\nGrant it with: pnpm event:host --keys <file> "<name>"   (★ already can)');
    return;
  }

  const matches = people.filter(
    ({ id, name }) => id === wanted || name.toLowerCase() === wanted.toLowerCase(),
  );
  const [match] = matches;
  if (match === undefined || matches.length > 1) {
    return fail(
      matches.length > 1
        ? `More than one profile is called "${wanted}": use the id instead.`
        : `Nobody called "${wanted}" has joined. Run it without a name to see who has.`,
    );
  }
  await publishEntry(
    client,
    keys,
    {
      meta: { kind: 'host', profileId: match.id, grantedAt: new Date().toISOString() },
      payload: new Uint8Array(0),
    },
    organizer.privateKey,
    snapshot.uploadPreset ?? organizer.uploadPreset ?? undefined,
  );
  console.log(`✔ ${match.name} can now open and close the voting from their phone.`);
};

await main();
