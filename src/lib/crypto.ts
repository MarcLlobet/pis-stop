import { concatBytes, toHex, utf8 } from './encoding';
import { frame, unframe } from './padding';
import type { Bytes } from './types';

export const SECRET_BYTES = 32;
export const FORMAT_VERSION = 1;
const IV_BYTES = 12;
const SALT = utf8('pis-stop/v1');

export interface EventKeys {
  /** Cloudinary tag under which the event's entries are listed. */
  readonly tag: string;
  /** Non-extractable AES-256-GCM key: usable by this page, never readable. */
  readonly aes: CryptoKey;
  /** Fingerprint of the organizer's public key, taken from the invite. */
  readonly organizer: string;
}

/**
 * What a ciphertext is for. It is bound as AES-GCM associated data, so a blob
 * made for one purpose can never be accepted as another (domain separation).
 */
export type Purpose =
  | { readonly kind: 'entry' }
  | { readonly kind: 'photo'; readonly photoId: string }
  | { readonly kind: 'location' };

export const ENTRY: Purpose = { kind: 'entry' };
export const LOCATION: Purpose = { kind: 'location' };

const purposePath = (purpose: Purpose): string => {
  switch (purpose.kind) {
    case 'entry':
      return 'entry';
    case 'location':
      return 'location';
    case 'photo':
      return `photo/${purpose.photoId}`;
  }
};

export const associatedData = (purpose: Purpose): Bytes =>
  utf8(`pis-stop/v${FORMAT_VERSION}/${purposePath(purpose)}`);

export const generateSecret = (): Bytes => crypto.getRandomValues(new Uint8Array(SECRET_BYTES));

export const sha256Hex = async (data: Bytes): Promise<string> =>
  toHex(await crypto.subtle.digest('SHA-256', data));

const hkdf = (info: string): HkdfParams => ({
  name: 'HKDF',
  hash: 'SHA-256',
  salt: SALT,
  info: utf8(info),
});

/**
 * Derives independent values from the 256-bit event secret. The secret is
 * already uniformly random, so HKDF is enough: no password stretching needed.
 * The raw secret is not kept: only the derived, non-extractable key is.
 */
export const deriveEventKeys = async (secret: Bytes, organizer: string): Promise<EventKeys> => {
  if (secret.length !== SECRET_BYTES) {
    throw new RangeError(`The event secret must be ${SECRET_BYTES} bytes`);
  }
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, [
    'deriveBits',
    'deriveKey',
  ]);
  const [tagBits, aes] = await Promise.all([
    crypto.subtle.deriveBits(hkdf('cloudinary-tag'), base, 256),
    crypto.subtle.deriveKey(hkdf('aes-gcm'), base, { name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]),
  ]);
  return { tag: `ps_${toHex(tagBits)}`, aes, organizer };
};

/**
 * Deterministic core of `seal`, exported for known-answer tests only.
 * Output: [ version (1 byte) ][ IV (12 bytes) ][ AES-GCM ciphertext + 16-byte tag ].
 */
export const sealWithIv = async (
  key: CryptoKey,
  plain: Bytes,
  purpose: Purpose,
  iv: Bytes,
): Promise<Bytes> => {
  if (iv.length !== IV_BYTES) {
    throw new RangeError(`The IV must be ${IV_BYTES} bytes`);
  }
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: associatedData(purpose) },
    key,
    await frame(plain),
  );
  return concatBytes([Uint8Array.of(FORMAT_VERSION), iv, new Uint8Array(cipher)]);
};

/** A fresh random 96-bit IV per message: safe far beyond this app's volume. */
export const seal = (key: CryptoKey, plain: Bytes, purpose: Purpose): Promise<Bytes> =>
  sealWithIv(key, plain, purpose, crypto.getRandomValues(new Uint8Array(IV_BYTES)));

/** Returns `null` for a wrong key, wrong purpose, unknown version or tampering. */
export const open = async (
  key: CryptoKey,
  sealed: Bytes,
  purpose: Purpose,
): Promise<Bytes | null> => {
  if (sealed.length <= 1 + IV_BYTES || sealed[0] !== FORMAT_VERSION) {
    return null;
  }
  try {
    const framed = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: sealed.slice(1, 1 + IV_BYTES),
        additionalData: associatedData(purpose),
      },
      key,
      sealed.slice(1 + IV_BYTES),
    );
    return unframe(new Uint8Array(framed));
  } catch {
    return null;
  }
};
