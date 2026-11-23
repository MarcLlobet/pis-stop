import { concatBytes, toHex, utf8 } from './encoding';
import type { Bytes } from './types';

export const SECRET_BYTES = 32;
const IV_BYTES = 12;
const SALT = utf8('pis-stop/v1');

export interface EventKeys {
  /** Cloudinary tag under which the event's entries are listed. */
  readonly tag: string;
  /** AES-GCM key that seals every entry and every full-size photo. */
  readonly aes: CryptoKey;
}

export const generateSecret = (): Bytes => crypto.getRandomValues(new Uint8Array(SECRET_BYTES));

const hkdf = (info: string): HkdfParams => ({
  name: 'HKDF',
  hash: 'SHA-256',
  salt: SALT,
  info: utf8(info),
});

/**
 * Derives independent values from the 256-bit event secret. The secret is
 * already high-entropy, so a fast KDF (HKDF) is enough: no stretching needed.
 */
export const deriveEventKeys = async (secret: Bytes): Promise<EventKeys> => {
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
  return { tag: `ps_${toHex(tagBits)}`, aes };
};

/** Output layout: [ 12-byte random IV ][ ciphertext + 16-byte auth tag ]. */
export const seal = async (key: CryptoKey, plain: Bytes): Promise<Bytes> => {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return concatBytes([iv, new Uint8Array(cipher)]);
};

/** Returns `null` for tampered data or a wrong key instead of throwing. */
export const open = async (key: CryptoKey, sealed: Bytes): Promise<Bytes | null> => {
  if (sealed.length <= IV_BYTES) {
    return null;
  }
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: sealed.slice(0, IV_BYTES) },
      key,
      sealed.slice(IV_BYTES),
    );
    return new Uint8Array(plain);
  } catch {
    return null;
  }
};
