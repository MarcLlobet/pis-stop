/**
 * Closes an event: deletes its own upload preset, so nobody can upload to it
 * any more. Photos stay readable by whoever has the invite.
 *
 *   pnpm event:close --keys out/<event>.keys.json
 *
 * Needs CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env. An event made
 * without them uses the shared preset: deleting that one by hand, in the
 * Cloudinary console, closes every event that shares it.
 */
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { isValidName } from '../src/lib/cloudinary';
import { deletePresetRequest, parseAdminCredentials } from '../src/lib/cloudinary-admin';
import { safeJsonParse } from '../src/lib/encoding';

const fail = (message: string): never => {
  console.error(`✖ ${message}`);
  process.exit(1);
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

const main = async (): Promise<void> => {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the real environment.
  }

  const { values } = parseArgs({ options: { keys: { type: 'string' } } });
  const path = values.keys ?? fail('Usage: pnpm event:close --keys out/<event>.keys.json');
  const saved = safeJsonParse(await readFile(path, 'utf8'));
  const preset = isRecord(saved) ? saved['uploadPreset'] : undefined;
  if (typeof preset !== 'string' || !isValidName(preset)) {
    return fail(
      `${path} has no upload preset of its own: this event uses the shared one.\n` +
        '  Deleting it in the Cloudinary console closes every event that shares it.',
    );
  }

  const credentials =
    parseAdminCredentials(process.env) ??
    fail('Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET (see .env.example)');
  const { url, init } = deletePresetRequest(credentials, preset);
  const response = await fetch(url, init);
  if (response.status === 404) {
    console.log(`✔ ${preset} was already deleted: the event is closed.`);
    return;
  }
  if (!response.ok) {
    fail(`Cloudinary refused to delete ${preset} (${String(response.status)})`);
  }
  console.log(
    `✔ Deleted ${preset}: the event is closed. Its photos stay readable with the invite.`,
  );
};

await main();
