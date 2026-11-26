import type { PhotoView } from './snapshot';
import type { LatLng } from './types';

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
