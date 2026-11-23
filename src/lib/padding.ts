import { concatBytes } from './encoding';
import type { Bytes } from './types';

/**
 * Padmé (Nikitin et al., "Reducing Metadata Leakage from Encrypted Files and
 * Communication with PURBs", PETS 2019). Rounds a length up so that only
 * O(log log L) bits of it leak, with at most ~12% overhead.
 */
export const padme = (length: number): number => {
  if (!Number.isInteger(length) || length < 0 || length > 0x7fffffff) {
    throw new RangeError('Length out of range');
  }
  if (length < 2) {
    return length;
  }
  const exponent = 31 - Math.clz32(length); // floor(log2 L)
  const exponentBits = 32 - Math.clz32(exponent); // floor(log2 E) + 1
  const lastBits = exponent - exponentBits;
  const mask = (1 << lastBits) - 1;
  return (length + mask) & ~mask;
};

const HEADER_BYTES = 4;

const u32 = (value: number): Bytes =>
  Uint8Array.of((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);

/** [ 4-byte big-endian length ][ data ][ zeros up to the Padmé size ] */
export const frame = async (data: Bytes): Promise<Bytes> => {
  const total = padme(HEADER_BYTES + data.length);
  return concatBytes([u32(data.length), data, new Uint8Array(total - HEADER_BYTES - data.length)]);
};

/** Strict: rejects a length that overflows or padding that is not all zeros. */
export const unframe = (framed: Bytes): Bytes | null => {
  if (framed.length < HEADER_BYTES) {
    return null;
  }
  const length = new DataView(framed.buffer, framed.byteOffset, framed.byteLength).getUint32(0);
  const end = HEADER_BYTES + length;
  if (end > framed.length || framed.subarray(end).some((byte) => byte !== 0)) {
    return null;
  }
  return framed.slice(HEADER_BYTES, end);
};
