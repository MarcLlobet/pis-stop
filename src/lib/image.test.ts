import { describe, expect, it } from 'vitest';

import { fitWithin } from './image';

describe('fitWithin', () => {
  it('scales the longest side down to the limit, keeping the ratio', () => {
    expect(fitWithin({ width: 4000, height: 3000 }, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin({ width: 3000, height: 4000 }, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('never upscales', () => {
    expect(fitWithin({ width: 300, height: 200 }, 1600)).toEqual({ width: 300, height: 200 });
  });

  it('never returns a zero-sized image', () => {
    expect(fitWithin({ width: 10_000, height: 1 }, 100)).toEqual({ width: 100, height: 1 });
    expect(fitWithin({ width: 0, height: 0 }, 100)).toEqual({ width: 1, height: 1 });
  });
});
