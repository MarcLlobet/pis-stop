import { describe, expect, it } from 'vitest';

import { deriveEventKeys, generateSecret, open, seal, SECRET_BYTES } from './crypto';
import { fromUtf8, utf8 } from './encoding';

describe('generateSecret', () => {
  it('returns 32 random bytes', () => {
    const a = generateSecret();
    expect(a).toHaveLength(SECRET_BYTES);
    expect(generateSecret()).not.toEqual(a);
  });
});

describe('deriveEventKeys', () => {
  it('derives a stable, hard-to-guess tag from the secret', async () => {
    const secret = new Uint8Array(SECRET_BYTES).fill(7);
    const first = await deriveEventKeys(secret);
    const second = await deriveEventKeys(secret);
    expect(first.tag).toMatch(/^ps_[0-9a-f]{64}$/);
    expect(second.tag).toBe(first.tag);
  });

  it('gives different events different tags', async () => {
    const a = await deriveEventKeys(generateSecret());
    const b = await deriveEventKeys(generateSecret());
    expect(a.tag).not.toBe(b.tag);
  });

  it('refuses secrets of the wrong size', async () => {
    await expect(deriveEventKeys(new Uint8Array(16))).rejects.toThrow(RangeError);
  });
});

describe('seal / open', () => {
  it('round-trips data and never repeats the ciphertext', async () => {
    const { aes } = await deriveEventKeys(generateSecret());
    const plain = utf8('Vermut a cal Biel');
    const first = await seal(aes, plain);
    const second = await seal(aes, plain);
    expect(first).not.toEqual(second);
    expect(fromUtf8((await open(aes, first))!)).toBe('Vermut a cal Biel');
  });

  it('returns null with the wrong key', async () => {
    const mine = await deriveEventKeys(generateSecret());
    const theirs = await deriveEventKeys(generateSecret());
    expect(await open(theirs.aes, await seal(mine.aes, utf8('privat')))).toBeNull();
  });

  it('returns null for tampered or truncated data', async () => {
    const { aes } = await deriveEventKeys(generateSecret());
    const sealed = await seal(aes, utf8('privat'));
    const tampered = sealed.map((byte, index) => (index === sealed.length - 1 ? byte ^ 1 : byte));
    expect(await open(aes, tampered)).toBeNull();
    expect(await open(aes, sealed.slice(0, 12))).toBeNull();
  });
});
