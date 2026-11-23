import { concatBytes, fromUtf8, safeJsonParse, utf8 } from './encoding';
import { parseMeta } from './meta';
import type { Bytes, Entry, Meta } from './types';

/**
 * Binary layout of an entry before encryption:
 *
 *   [ 4 bytes: metadata length (big-endian) ][ metadata JSON ][ payload ]
 */
const HEADER_BYTES = 4;

const lengthHeader = (length: number): Bytes =>
  Uint8Array.of(
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
  );

export const packEntry = async <M extends Meta>(entry: Entry<M>): Promise<Bytes> => {
  const json = utf8(JSON.stringify(entry.meta));
  return concatBytes([lengthHeader(json.length), json, entry.payload]);
};

export const unpackEntry = (bytes: Bytes): Entry | null => {
  if (bytes.length < HEADER_BYTES) {
    return null;
  }
  const metaLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  const metaEnd = HEADER_BYTES + metaLength;
  if (metaEnd > bytes.length) {
    return null;
  }
  const meta = parseMeta(safeJsonParse(fromUtf8(bytes.subarray(HEADER_BYTES, metaEnd))));
  return meta ? { meta, payload: bytes.slice(metaEnd) } : null;
};
