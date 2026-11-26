import { LOCATION, open, seal } from './crypto';
import { concatBytes, fromUtf8, utf8 } from './encoding';
import { sign, SIGNATURE_BYTES, verify } from './identity';
import type { Bytes, LatLng } from './types';

export interface LocationPing {
  readonly authorId: string;
  readonly position: LatLng;
  readonly at: Date;
}

/**
 * Plaintext layout of a ping (it is then sealed, see crypto.ts):
 *
 *   [ signature (64) ][ lat f64 (8) ][ lng f64 (8) ][ at ms epoch f64 (8) ][ authorId utf8 ]
 *                     \_______________________ signed message ________________________/
 *
 * The author is signed in, not just carried by whoever relays the message
 * (Ably's `clientId` is not something the shared, capability-restricted key
 * can be trusted to have set truthfully): the signature only ever verifies
 * for the one person who actually made it.
 */
const FIELD_BYTES = 8;
const FIXED_BYTES = FIELD_BYTES * 3;
const MAX_AUTHOR_ID_BYTES = 64;

export const signedMessageOf = async (ping: LocationPing): Promise<Bytes> => {
  const fixed = new DataView(new ArrayBuffer(FIXED_BYTES));
  fixed.setFloat64(0, ping.position.lat);
  fixed.setFloat64(FIELD_BYTES, ping.position.lng);
  fixed.setFloat64(FIELD_BYTES * 2, ping.at.getTime());
  return concatBytes([new Uint8Array(fixed.buffer), utf8(ping.authorId)]);
};

export const packPing = async (ping: LocationPing, privateKey: CryptoKey): Promise<Bytes> => {
  const message = await signedMessageOf(ping);
  return concatBytes([await sign(privateKey, message), message]);
};

interface UnpackedPing {
  readonly ping: LocationPing;
  readonly signature: Bytes;
  readonly signedMessage: Bytes;
}

/** `null` for anything truncated, oversized, or with an implausible field. */
export const unpackPing = (bytes: Bytes): UnpackedPing | null => {
  if (bytes.length <= SIGNATURE_BYTES + FIXED_BYTES) {
    return null;
  }
  const message = bytes.slice(SIGNATURE_BYTES);
  const fixed = new DataView(message.slice(0, FIXED_BYTES).buffer);
  const lat = fixed.getFloat64(0);
  const lng = fixed.getFloat64(FIELD_BYTES);
  const at = fixed.getFloat64(FIELD_BYTES * 2);
  const authorId = fromUtf8(message.slice(FIXED_BYTES));
  const valid =
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    Number.isFinite(lng) &&
    Math.abs(lng) <= 180 &&
    Number.isFinite(at) &&
    authorId.length > 0 &&
    authorId.length <= MAX_AUTHOR_ID_BYTES;
  return valid
    ? {
        ping: { authorId, position: { lat, lng }, at: new Date(at) },
        signature: bytes.slice(0, SIGNATURE_BYTES),
        signedMessage: message,
      }
    : null;
};

/** Signs with the sender's own identity key, then seals for Ably: it only sees noise. */
export const sealPing = async (
  aes: CryptoKey,
  privateKey: CryptoKey,
  ping: LocationPing,
): Promise<Bytes> => seal(aes, await packPing(ping, privateKey), LOCATION);

/** Resolves a known profile's public key, or `null` if the author is unrecognised. */
export type PublicKeyOf = (authorId: string) => Promise<CryptoKey | null>;

/**
 * Opens, unpacks, then verifies the signature against the author's already-known
 * public key. `null` for a wrong key, tampering, an unknown author, or a bad
 * signature: never throws, and never trusts an unverified position.
 */
export const openPing = async (
  aes: CryptoKey,
  sealed: Bytes,
  publicKeyOf: PublicKeyOf,
): Promise<LocationPing | null> => {
  const plain = await open(aes, sealed, LOCATION);
  const unpacked = plain === null ? null : unpackPing(plain);
  if (unpacked === null) {
    return null;
  }
  const publicKey = await publicKeyOf(unpacked.ping.authorId);
  if (publicKey === null) {
    return null;
  }
  const verified = await verify(publicKey, unpacked.signature, unpacked.signedMessage);
  return verified ? unpacked.ping : null;
};

/** A peer's position is faded after this long without a fresh ping... */
export const STALE_MS = 90_000;
/** ...and dropped altogether after this long: likely gone, not just quiet. */
export const EXPIRE_MS = 5 * 60_000;

/**
 * Staleness is judged by the recipient's own clock (`receivedAt`), not the
 * sender's `at`: phones' clocks are not synced, so `at` is only useful to
 * reject an older ping arriving after a newer one already shown.
 */
export const isStale = (receivedAt: number, now: number): boolean => now - receivedAt > STALE_MS;
export const isExpired = (receivedAt: number, now: number): boolean => now - receivedAt > EXPIRE_MS;
