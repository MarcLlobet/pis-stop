import { describe, expect, it } from 'vitest';

import {
  concatBytes,
  fromBase64Url,
  fromUtf8,
  safeJsonParse,
  toBase64Url,
  toHex,
  utf8,
} from './encoding';

describe('utf8', () => {
  it('round-trips text with accents and emoji', () => {
    const text = 'Plaça del Sol · 🍻';
    expect(fromUtf8(utf8(text))).toBe(text);
  });
});

describe('toHex', () => {
  it('encodes bytes and buffers with two digits per byte', () => {
    expect(toHex(Uint8Array.of(0, 15, 255))).toBe('000fff');
    expect(toHex(Uint8Array.of(1, 2).buffer)).toBe('0102');
  });
});

describe('base64url', () => {
  it('round-trips every byte value without padding or unsafe characters', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, index) => index);
    const encoded = toBase64Url(bytes);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(fromBase64Url(encoded)).toEqual(bytes);
  });

  it.each([1, 2, 3, 4, 31, 32])('round-trips %i bytes', (length) => {
    const bytes = Uint8Array.from({ length }, (_, index) => (index * 37) % 256);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });

  it('rejects malformed input instead of throwing', () => {
    expect(fromBase64Url('not base64!')).toBeNull();
    expect(fromBase64Url('abcde')).toBeNull();
  });

  it('decodes the empty string to no bytes', () => {
    expect(fromBase64Url('')).toEqual(new Uint8Array(0));
  });
});

describe('concatBytes', () => {
  it('joins chunks in order and leaves the inputs untouched', async () => {
    const a = Uint8Array.of(1, 2);
    const b = Uint8Array.of(3);
    expect(await concatBytes([a, b, new Uint8Array(0)])).toEqual(Uint8Array.of(1, 2, 3));
    expect(a).toEqual(Uint8Array.of(1, 2));
  });
});

describe('safeJsonParse', () => {
  it('parses valid JSON and returns undefined otherwise', () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
    expect(safeJsonParse('{nope')).toBeUndefined();
  });
});
