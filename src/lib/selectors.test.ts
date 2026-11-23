import { describe, expect, it } from 'vitest';

import { photoView } from '../test/fixtures';
import { countByStop, filterByAuthors, photosOfStop, placedPhotos, toggleInSet } from './selectors';

const photos = [
  photoView('1', { stopId: 's1', authorId: 'anna' }),
  photoView('2', { stopId: 's1', authorId: 'biel' }),
  photoView('3', { stopId: 's2', authorId: 'anna' }),
  photoView('4', { stopId: null, authorId: 'biel' }),
  photoView('5', { stopId: null, position: null, authorId: 'biel' }),
];

describe('selectors', () => {
  it('lists the photos of one stop', () => {
    expect(photosOfStop(photos, 's1').map(({ id }) => id)).toEqual(['1', '2']);
  });

  it('counts photos per stop, ignoring loose ones', () => {
    expect(countByStop(photos)).toEqual(
      new Map([
        ['s1', 2],
        ['s2', 1],
      ]),
    );
  });

  it('pins every photo that has a location, at a stop or not', () => {
    expect(placedPhotos(photos).map(({ id }) => id)).toEqual(['1', '2', '3', '4']);
  });

  it('filters by author, or returns everything when no author is selected', () => {
    expect(filterByAuthors(photos, new Set(['anna'])).map(({ id }) => id)).toEqual(['1', '3']);
    expect(filterByAuthors(photos, new Set())).toBe(photos);
  });

  it('toggles values immutably', () => {
    const empty = new Set<string>();
    const withAnna = toggleInSet(empty, 'anna');
    expect([...withAnna]).toEqual(['anna']);
    expect([...toggleInSet(withAnna, 'anna')]).toEqual([]);
    expect(empty.size).toBe(0);
  });
});
