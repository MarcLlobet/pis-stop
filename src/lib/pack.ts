import { concatBytes, fromUtf8, safeJsonParse, utf8 } from './encoding';
import { sign, SIGNATURE_BYTES } from './identity';
import { parseMeta } from './meta';
import type { Bytes, Entry, Meta, SignedEntry } from './types';

/**
 * Plaintext layout of an entry (it is then sealed, see crypto.ts):
 *
 *   [ signature (64) ][ metadata length (4, big-endian) ][ metadata JSON ][ payload ]
 *                     \___________________ signed message ___________________/
 */
const LENGTH_BYTES = 4;

const lengthHeader = (length: number): Bytes =>
  Uint8Array.of(
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
  );

/** The exact bytes a signature covers: metadata and payload, unambiguously framed. */
export const signedMessageOf = async <M extends Meta>(entry: Entry<M>): Promise<Bytes> => {
  const json = utf8(JSON.stringify(entry.meta));
  return concatBytes([lengthHeader(json.length), json, entry.payload]);
};

export const packSigned = async <M extends Meta>(
  entry: Entry<M>,
  privateKey: CryptoKey,
): Promise<Bytes> => {
  const message = await signedMessageOf(entry);
  return concatBytes([await sign(privateKey, message), message]);
};

export const unpackSigned = (bytes: Bytes): SignedEntry | null => {
  if (bytes.length < SIGNATURE_BYTES + LENGTH_BYTES) {
    return null;
  }
  const message = bytes.slice(SIGNATURE_BYTES);
  const metaLength = new DataView(message.buffer).getUint32(0);
  const metaEnd = LENGTH_BYTES + metaLength;
  if (metaEnd > message.length) {
    return null;
  }
  const meta = parseMeta(safeJsonParse(fromUtf8(message.subarray(LENGTH_BYTES, metaEnd))));
  return meta === null
    ? null
    : {
        meta,
        payload: message.slice(metaEnd),
        signature: bytes.slice(0, SIGNATURE_BYTES),
        signedMessage: message,
      };
};
