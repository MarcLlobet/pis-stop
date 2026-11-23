import { describe, expect, it } from 'vitest';

import { concatBytes, utf8 } from './encoding';
import { packEntry, unpackEntry } from './pack';
import type { Entry, Stop } from './types';

const entry: Entry<Stop> = {
  meta: { kind: 'stop', id: 's1', name: 'Pis', order: 1, position: { lat: 41, lng: 2 } },
  payload: Uint8Array.of(9, 8, 7),
};

describe('packEntry / unpackEntry', () => {
  it('round-trips metadata and payload', async () => {
    expect(unpackEntry(await packEntry(entry))).toEqual(entry);
  });

  it('supports an empty payload', async () => {
    const empty = { ...entry, payload: new Uint8Array(0) };
    expect(unpackEntry(await packEntry(empty))).toEqual(empty);
  });

  it('rejects data shorter than the header', () => {
    expect(unpackEntry(Uint8Array.of(0, 0))).toBeNull();
  });

  it('rejects a header that points past the end', () => {
    expect(unpackEntry(Uint8Array.of(0, 0, 0, 50, 1, 2))).toBeNull();
  });

  it('rejects metadata that is not valid JSON or not a known entry', async () => {
    const invalidJson = await concatBytes([Uint8Array.of(0, 0, 0, 2), utf8('{x')]);
    const unknown = utf8('{"kind":"nope"}');
    const unknownKind = await concatBytes([Uint8Array.of(0, 0, 0, unknown.length), unknown]);
    expect(unpackEntry(invalidJson)).toBeNull();
    expect(unpackEntry(unknownKind)).toBeNull();
  });
});
