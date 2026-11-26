import { describe, expect, it } from 'vitest';

import { photoView } from '../test/fixtures';
import { filterByAuthors, placedPhotos, toggleInSet } from './selectors';

const photos = [
  photoView('1', { authorId: 'anna' }),
  photoView('2', { authorId: 'biel' }),
  photoView('3', { authorId: 'anna' }),
  photoView('4', { authorId: 'biel' }),
  photoView('5', { position: null, authorId: 'biel' }),
];

describe('selectors', () => {
  it('pins every photo that has a location', () => {
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
