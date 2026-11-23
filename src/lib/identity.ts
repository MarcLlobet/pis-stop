import { concatBytes, fromBase64Url, toBase64Url, toHex, utf8 } from './encoding';
import type { Bytes } from './types';

const KEY_ALGORITHM: EcKeyGenParams = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_ALGORITHM: EcdsaParams = { name: 'ECDSA', hash: 'SHA-256' };
const PUBLIC_KEY_BYTES = 65; // uncompressed P-256 point
const FINGERPRINT_BYTES = 16;
export const SIGNATURE_BYTES = 64; // r || s (IEEE P1363), as WebCrypto returns it
const SIGNATURE_DOMAIN = utf8('pis-stop/v1/signature\0');

/** A signing identity. The private key is non-extractable unless stated otherwise. */
export interface Identity {
  /** Fingerprint of the public key: the identifier other people see. */
  readonly id: string;
  /** Raw public key, base64url. */
  readonly publicKey: string;
  readonly privateKey: CryptoKey;
}

/**
 * Self-certifying identifier: the first 128 bits of SHA-256(public key).
 * Nobody can claim someone else's id without that person's private key.
 */
export const fingerprint = async (publicKey: Bytes): Promise<string> =>
  toBase64Url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', publicKey)).slice(0, FINGERPRINT_BYTES),
  );

export const fingerprintOf = async (publicKey: string): Promise<string | null> => {
  const raw = fromBase64Url(publicKey);
  return raw?.length === PUBLIC_KEY_BYTES ? fingerprint(raw) : null;
};

/** Short code people can compare out loud, like Signal's safety numbers. */
export const safetyCode = (id: string): string => {
  const bytes = fromBase64Url(id);
  const hex = bytes === null ? '' : toHex(bytes.slice(0, 4));
  return hex === '' ? '????' : `${hex.slice(0, 4)} ${hex.slice(4, 8)}`.toUpperCase();
};

export const generateIdentity = async (extractable = false): Promise<Identity> => {
  const pair = await crypto.subtle.generateKey(KEY_ALGORITHM, extractable, ['sign', 'verify']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { id: await fingerprint(raw), publicKey: toBase64Url(raw), privateKey: pair.privateKey };
};

export const importPublicKey = async (publicKey: string): Promise<CryptoKey | null> => {
  const raw = fromBase64Url(publicKey);
  if (raw?.length !== PUBLIC_KEY_BYTES) {
    return null;
  }
  try {
    return await crypto.subtle.importKey('raw', raw, KEY_ALGORITHM, false, ['verify']);
  } catch {
    return null;
  }
};

/** Everything signed is prefixed with a fixed domain string. */
export const signingInput = (message: Bytes): Promise<Bytes> =>
  concatBytes([SIGNATURE_DOMAIN, message]);

export const sign = async (privateKey: CryptoKey, message: Bytes): Promise<Bytes> =>
  new Uint8Array(await crypto.subtle.sign(SIGN_ALGORITHM, privateKey, await signingInput(message)));

export const verify = async (
  publicKey: CryptoKey,
  signature: Bytes,
  message: Bytes,
): Promise<boolean> => {
  if (signature.length !== SIGNATURE_BYTES) {
    return false;
  }
  return crypto.subtle.verify(SIGN_ALGORITHM, publicKey, signature, await signingInput(message));
};
