import { describe, expect, it } from 'vitest';

import { frame, padme, unframe } from './padding';

describe('padme', () => {
  it.each([
    [0, 0],
    [1, 1],
    [4, 4],
    [9, 10],
    [12, 12],
    [100, 104],
    [1000, 1024],
    [1023, 1024],
    [1025, 1088],
    [65537, 67584],
    [1_000_000, 1_015_808],
  ])('pads %i to %i (same values as the paper and the Python check)', (length, padded) => {
    expect(padme(length)).toBe(padded);
  });

  it('never shrinks and keeps the overhead under 12%', () => {
    const lengths = Array.from({ length: 2000 }, (_, index) => index * 997 + 2);
    expect(lengths.every((length) => padme(length) >= length)).toBe(true);
    expect(lengths.every((length) => padme(length) <= length * 1.12)).toBe(true);
  });

  it('collapses many lengths into few sizes', () => {
    const sizes = new Set(Array.from({ length: 1024 }, (_, index) => padme(30_000 + index)));
    expect(sizes.size).toBeLessThan(5);
  });

  it('rejects invalid lengths', () => {
    expect(() => padme(-1)).toThrow(RangeError);
    expect(() => padme(1.5)).toThrow(RangeError);
  });
});

describe('frame / unframe', () => {
  it('round-trips data of any length', async () => {
    const samples = [0, 1, 5, 100, 4097].map((length) =>
      Uint8Array.from({ length }, (_, index) => index % 251),
    );
    const framed = await Promise.all(samples.map(frame));
    expect(framed.map(unframe)).toEqual(samples);
    expect(framed.map(({ length }) => length)).toEqual(
      samples.map(({ length }) => padme(length + 4)),
    );
  });

  it('rejects truncated data, overflowing lengths and non-zero padding', async () => {
    const framed = await frame(Uint8Array.of(1, 2, 3, 4, 5));
    expect(unframe(Uint8Array.of(0, 0))).toBeNull();
    expect(unframe(Uint8Array.of(0, 0, 0, 9, 1))).toBeNull();
    const dirty = framed.map((byte, index) => (index === framed.length - 1 ? 1 : byte));
    expect(unframe(dirty)).toBeNull();
  });
});
