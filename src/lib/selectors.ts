import type { PhotoView } from './snapshot';

export const photosOfStop = (photos: readonly PhotoView[], stopId: string): readonly PhotoView[] =>
  photos.filter((photo) => photo.stopId === stopId);

export const countByStop = (photos: readonly PhotoView[]): ReadonlyMap<string, number> =>
  photos.reduce<ReadonlyMap<string, number>>(
    (counts, { stopId }) =>
      stopId === null ? counts : new Map([...counts, [stopId, (counts.get(stopId) ?? 0) + 1]]),
    new Map(),
  );

/** Photos that were not close enough to any stop: they get their own pin. */
export const loosePhotos = (photos: readonly PhotoView[]): readonly PhotoView[] =>
  photos.filter((photo) => photo.stopId === null && photo.position !== null);

export const filterByAuthors = (
  photos: readonly PhotoView[],
  authorIds: ReadonlySet<string>,
): readonly PhotoView[] =>
  authorIds.size === 0 ? photos : photos.filter((photo) => authorIds.has(photo.authorId));

export const toggleInSet = <T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> =>
  set.has(value) ? new Set([...set].filter((item) => item !== value)) : new Set([...set, value]);
