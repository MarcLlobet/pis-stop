import { readFile } from 'node:fs/promises';

import { isValidName } from '../src/lib/cloudinary';
import { SECRET_BYTES } from '../src/lib/crypto';
import { fromBase64Url, safeJsonParse } from '../src/lib/encoding';
import type { Bytes } from '../src/lib/types';

export interface Organizer {
  readonly secret: Bytes;
  readonly publicKey: string;
  readonly privateKey: CryptoKey;
  /** This event's own upload preset; `null` when it uses the shared default. */
  readonly uploadPreset: string | null;
}

export const SIGNING = { name: 'ECDSA', namedCurve: 'P-256' } as const;

export const fail = (message: string): never => {
  console.error(`✖ ${message}`);
  process.exit(1);
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

/** Reads the keys file written by `pnpm event:create`. */
export const loadOrganizer = async (path: string): Promise<Organizer> => {
  const saved = safeJsonParse(await readFile(path, 'utf8'));
  if (!isRecord(saved) || typeof saved['secret'] !== 'string' || !isRecord(saved['privateKey'])) {
    return fail(`${path} is not a keys file written by this script`);
  }
  const secret = fromBase64Url(saved['secret']);
  const publicKey = saved['publicKey'];
  const savedPreset = saved['uploadPreset'] ?? null;
  const uploadPreset =
    typeof savedPreset === 'string' && isValidName(savedPreset) ? savedPreset : null;
  if (
    secret?.length !== SECRET_BYTES ||
    typeof publicKey !== 'string' ||
    (savedPreset !== null && uploadPreset === null)
  ) {
    return fail(`${path} is corrupted`);
  }
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    saved['privateKey'] as JsonWebKey,
    SIGNING,
    false,
    ['sign'],
  );
  return { secret, publicKey, privateKey, uploadPreset };
};
