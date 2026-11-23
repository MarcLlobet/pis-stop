import { describe, expect, it } from 'vitest';

import {
  associatedData,
  deriveEventKeys,
  ENTRY,
  generateSecret,
  open,
  seal,
  sealWithIv,
  SECRET_BYTES,
  sha256Hex,
} from './crypto';
import { fromUtf8, toHex, utf8 } from './encoding';

const keysFor = (secret = generateSecret()) => deriveEventKeys(secret, 'organizer');

/**
 * Known-answer tests. The same values are recomputed by an independent Python
 * implementation in scripts/verify_vectors.py and listed in docs/PROTOCOL.md.
 */
describe('known-answer vectors', () => {
  const secret = Uint8Array.from({ length: 32 }, (_, index) => index);
  const iv = Uint8Array.from({ length: 12 }, (_, index) => 0xa0 + index);

  it('derives the documented tag', async () => {
    expect((await keysFor(secret)).tag).toBe(
      'ps_496af9b1b7b58aba5b645f6be86dc144ab5c631f1517f11fb2bb5f5daf7c80d8',
    );
  });

  it('produces the documented ciphertexts for each purpose', async () => {
    const { aes } = await keysFor(secret);
    expect(toHex(await sealWithIv(aes, utf8('Pis Stop'), ENTRY, iv))).toBe(
      '01a0a1a2a3a4a5a6a7a8a9aaabb6b9b2a0122b9ee1c1a55009479cb21eb4910fe328aca22175c31538',
    );
    expect(
      toHex(await sealWithIv(aes, utf8('Pis Stop'), { kind: 'photo', photoId: 'p1' }, iv)),
    ).toBe('01a0a1a2a3a4a5a6a7a8a9aaabb6b9b2a0122b9ee1c1a550091526130e82cf19059e3292bf2aec4d1f');
  });
});

describe('deriveEventKeys', () => {
  it('derives a stable tag, keeps the organizer and makes the key non-extractable', async () => {
    const secret = generateSecret();
    const first = await keysFor(secret);
    const second = await keysFor(secret);
    expect(first.tag).toMatch(/^ps_[0-9a-f]{64}$/);
    expect(second.tag).toBe(first.tag);
    expect(first.organizer).toBe('organizer');
    expect(first.aes.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', first.aes)).rejects.toThrow();
  });

  it('gives different events different tags', async () => {
    expect((await keysFor()).tag).not.toBe((await keysFor()).tag);
  });

  it('refuses secrets of the wrong size', async () => {
    await expect(deriveEventKeys(new Uint8Array(16), 'o')).rejects.toThrow(RangeError);
    expect(generateSecret()).toHaveLength(SECRET_BYTES);
  });
});

describe('seal / open', () => {
  it('round-trips data and never repeats the ciphertext', async () => {
    const { aes } = await keysFor();
    const first = await seal(aes, utf8('Vermut a cal Biel'), ENTRY);
    const second = await seal(aes, utf8('Vermut a cal Biel'), ENTRY);
    expect(first).not.toEqual(second);
    expect(fromUtf8((await open(aes, first, ENTRY))!)).toBe('Vermut a cal Biel');
  });

  it('hides the exact length behind Padmé padding', async () => {
    const { aes } = await keysFor();
    const sizes = await Promise.all(
      [1000, 1010, 1019].map(
        async (length) => (await seal(aes, new Uint8Array(length), ENTRY)).length,
      ),
    );
    expect(new Set(sizes).size).toBe(1);
  });

  it('binds the purpose: an entry is not a photo, photo p1 is not photo p2', async () => {
    const { aes } = await keysFor();
    const photo = await seal(aes, utf8('x'), { kind: 'photo', photoId: 'p1' });
    expect(await open(aes, photo, ENTRY)).toBeNull();
    expect(await open(aes, photo, { kind: 'photo', photoId: 'p2' })).toBeNull();
    expect(await open(aes, photo, { kind: 'photo', photoId: 'p1' })).toEqual(utf8('x'));
  });

  it('returns null with the wrong key, a wrong version or tampering', async () => {
    const mine = await keysFor();
    const theirs = await keysFor();
    const sealed = await seal(mine.aes, utf8('privat'), ENTRY);
    const flip = (index: number) => sealed.map((byte, i) => (i === index ? byte ^ 1 : byte));

    expect(await open(theirs.aes, sealed, ENTRY)).toBeNull();
    expect(await open(mine.aes, flip(0), ENTRY)).toBeNull();
    expect(await open(mine.aes, flip(5), ENTRY)).toBeNull();
    expect(await open(mine.aes, flip(sealed.length - 1), ENTRY)).toBeNull();
    expect(await open(mine.aes, sealed.slice(0, 13), ENTRY)).toBeNull();
  });

  it('rejects an IV of the wrong size', async () => {
    const { aes } = await keysFor();
    await expect(sealWithIv(aes, utf8('x'), ENTRY, new Uint8Array(8))).rejects.toThrow(RangeError);
  });
});

describe('helpers', () => {
  it('describes each purpose with a distinct associated-data string', () => {
    expect(fromUtf8(associatedData(ENTRY))).toBe('pis-stop/v1/entry');
    expect(fromUtf8(associatedData({ kind: 'photo', photoId: 'p1' }))).toBe('pis-stop/v1/photo/p1');
  });

  it('hashes with SHA-256', async () => {
    expect(await sha256Hex(utf8('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
