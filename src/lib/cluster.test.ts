import { describe, expect, it } from 'vitest';

import { clusterPoints } from './cluster';

const point = (item: string, x: number, y: number) => ({ item, x, y });

describe('clusterPoints', () => {
  it('groups points closer than the radius', () => {
    const clusters = clusterPoints(
      [point('a', 0, 0), point('b', 10, 10), point('c', 200, 0), point('d', 205, 3)],
      40,
    );
    expect(clusters.map(({ items }) => items)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('keeps distant points apart', () => {
    expect(clusterPoints([point('a', 0, 0), point('b', 100, 0)], 40)).toHaveLength(2);
  });

  it('anchors each cluster on its first point', () => {
    expect(clusterPoints([point('a', 5, 6), point('b', 7, 8)], 40)).toEqual([
      { items: ['a', 'b'], x: 5, y: 6 },
    ]);
  });

  it('handles no points', () => {
    expect(clusterPoints([], 40)).toEqual([]);
  });
});
