/**
 * Everything needed to take every photo of an event home, decrypted, used by
 * `pnpm event:export` on the organizer's computer. It goes through the same
 * verified path as the app: only photos signed by a member of the event, and
 * only full-size images that match the hash their author signed.
 */
import { fromBase64Url, toBase64Url } from './encoding';
import { slugify } from './event-file';
import type { EventRepository, RepositoryDeps } from './repository';
import type { Snapshot } from './snapshot';
import type { Bytes, LatLng, Photo } from './types';

/**
 * Repository dependencies for a script: decrypted images come back as their
 * bytes (base64url) instead of browser object URLs.
 */
export const EXPORT_DEPS: RepositoryDeps = {
  toUrl: (bytes) => toBase64Url(bytes),
  newId: () => crypto.randomUUID(),
  now: () => new Date(),
};

export interface ExportedPhoto {
  readonly fileName: string;
  readonly bytes: Bytes;
  readonly author: string;
  readonly takenAt: string;
  readonly position: LatLng | null;
}

export interface ExportResult {
  readonly exported: readonly ExportedPhoto[];
  /** Photos whose full-size image is missing or failed its integrity check. */
  readonly failed: readonly Photo[];
}

const UNKNOWN_AUTHOR = 'algu';

/** `001-2026-12-12_21-04-33-julia.jpg`: sorts by time, says who took it. */
export const exportFileName = (index: number, takenAt: string, author: string): string => {
  const time = takenAt.slice(0, 19).replace('T', '_').replaceAll(':', '-');
  const who = slugify(author) || UNKNOWN_AUTHOR;
  return `${String(index + 1).padStart(3, '0')}-${time}-${who}.jpg`;
};

/** Downloads and decrypts every photo, oldest first; one failure never stops the rest. */
export const collectPhotos = async (
  repository: EventRepository,
  snapshot: Snapshot,
  onProgress: (done: number, total: number) => void = () => undefined,
): Promise<ExportResult> => {
  const photos = [...snapshot.photos].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  return photos.reduce<Promise<ExportResult>>(
    async (previous, photo, index) => {
      const { exported, failed } = await previous;
      const bytes = await repository
        .openPhoto(photo)
        .then(fromBase64Url)
        .catch(() => null);
      onProgress(index + 1, photos.length);
      if (bytes === null) {
        return { exported, failed: [...failed, photo] };
      }
      const author = snapshot.profiles.get(photo.authorId)?.name ?? UNKNOWN_AUTHOR;
      return {
        exported: [
          ...exported,
          {
            fileName: exportFileName(index, photo.takenAt, author),
            bytes,
            author,
            takenAt: photo.takenAt,
            position: photo.position,
          },
        ],
        failed,
      };
    },
    Promise.resolve({ exported: [], failed: [] }),
  );
};
