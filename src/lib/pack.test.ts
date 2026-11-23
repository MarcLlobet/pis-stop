import { describe, expect, it } from 'vitest';

import { concatBytes, utf8 } from './encoding';
import { generateIdentity, importPublicKey, verify } from './identity';
import { packSigned, signedMessageOf, unpackSigned } from './pack';
import type { Entry, Stop } from './types';

const entry: Entry<Stop> = {
  meta: { kind: 'stop', id: 's1', name: 'Pis', order: 1, position: { lat: 41, lng: 2 } },
  payload: Uint8Array.of(9, 8, 7),
};

describe('packSigned / unpackSigned', () => {
  it('round-trips metadata and payload with a signature over both', async () => {
    const identity = await generateIdentity();
    const unpacked = unpackSigned(await packSigned(entry, identity.privateKey))!;
    const key = (await importPublicKey(identity.publicKey))!;

    expect(unpacked.meta).toEqual(entry.meta);
    expect(unpacked.payload).toEqual(entry.payload);
    expect(unpacked.signedMessage).toEqual(await signedMessageOf(entry));
    expect(await verify(key, unpacked.signature, unpacked.signedMessage)).toBe(true);
  });

  it('frames metadata so payload bytes can never be read as metadata', async () => {
    const a = await signedMessageOf({ ...entry, payload: utf8('}') });
    const b = await signedMessageOf({ ...entry, payload: utf8('') });
    expect(a).not.toEqual(b);
  });

  it('rejects data shorter than signature + header', () => {
    expect(unpackSigned(new Uint8Array(67))).toBeNull();
  });

  it('rejects a length that points past the end', async () => {
    const bytes = await concatBytes([new Uint8Array(64), Uint8Array.of(0, 0, 0, 50, 1, 2)]);
    expect(unpackSigned(bytes)).toBeNull();
  });

  it('rejects metadata that is not valid JSON or not a known entry', async () => {
    const withMeta = (json: string) => {
      const meta = utf8(json);
      return concatBytes([new Uint8Array(64), Uint8Array.of(0, 0, 0, meta.length), meta]);
    };
    expect(unpackSigned(await withMeta('{x'))).toBeNull();
    expect(unpackSigned(await withMeta('{"kind":"nope"}'))).toBeNull();
  });
});
