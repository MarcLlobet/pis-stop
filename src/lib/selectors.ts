import type { PhotoView } from './snapshot';
import type { LatLng } from './types';

export const photosOfStop = (photos: readonly PhotoView[], stopId: string): readonly PhotoView[] =>
  photos.filter((photo) => photo.stopId === stopId);

export const countByStop = (photos: readonly PhotoView[]): ReadonlyMap<string, number> =>
  photos.reduce<ReadonlyMap<string, number>>(
    (counts, { stopId }) =>
      stopId === null ? counts : new Map([...counts, [stopId, (counts.get(stopId) ?? 0) + 1]]),
    new Map(),
  );

export type PlacedPhoto = PhotoView & { readonly position: LatLng };

/**
 * Every photo with a location gets its own pin, wherever it was taken: at a
 * flat, on the way, or anywhere else. Stops only mark the itinerary.
 */
export const placedPhotos = (photos: readonly PhotoView[]): readonly PlacedPhoto[] =>
  photos.filter((photo): photo is PlacedPhoto => photo.position !== null);

export const filterByAuthors = (
  photos: readonly PhotoView[],
  authorIds: ReadonlySet<string>,
): readonly PhotoView[] =>
  authorIds.size === 0 ? photos : photos.filter((photo) => authorIds.has(photo.authorId));

export const toggleInSet = <T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> =>
  set.has(value) ? new Set([...set].filter((item) => item !== value)) : new Set([...set, value]);
