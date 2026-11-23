import { useCallback, useState } from 'react';

import { nearestStop } from '../lib/geo';
import type { Identity } from '../lib/identity';
import { FULL_MAX_SIDE, THUMB_MAX_SIDE } from '../lib/image';
import type { EventRepository } from '../lib/repository';
import type { PhotoView } from '../lib/snapshot';
import type { Stop } from '../lib/types';
import { currentPosition } from '../platform/geolocation';
import { encodeImage } from '../platform/image';

export type UploadStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'uploading'; readonly done: number; readonly total: number }
  | { readonly kind: 'error'; readonly message: string };

interface UploadOptions {
  readonly repository: EventRepository;
  readonly stops: readonly Stop[];
  readonly identity: Identity;
  readonly onPhoto: (photo: PhotoView) => void;
}

export const useUpload = ({ repository, stops, identity, onPhoto }: UploadOptions) => {
  const [status, setStatus] = useState<UploadStatus>({ kind: 'idle' });

  const uploadFiles = useCallback(
    async (files: readonly File[]) => {
      const total = files.length;
      if (total === 0) {
        return;
      }
      setStatus({ kind: 'uploading', done: 0, total });
      try {
        // One location for the whole batch: you are at one flat at a time.
        const position = await currentPosition();
        const stopId = position === null ? null : (nearestStop(stops, position)?.id ?? null);
        // Sequential on purpose: phones on mobile data choke on parallel uploads.
        await files.reduce(async (previous, file, index) => {
          await previous;
          // Re-encoding also strips EXIF (GPS, camera serial) from the original.
          const [full, thumb] = await Promise.all([
            encodeImage(file, FULL_MAX_SIDE, 0.82),
            encodeImage(file, THUMB_MAX_SIDE, 0.72),
          ]);
          onPhoto(await repository.publishPhoto(identity, { stopId, position, full, thumb }));
          setStatus({ kind: 'uploading', done: index + 1, total });
        }, Promise.resolve());
        setStatus({ kind: 'idle' });
      } catch (error) {
        setStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'No s’ha pogut pujar la foto',
        });
      }
    },
    [repository, stops, identity, onPhoto],
  );

  const dismiss = useCallback(() => {
    setStatus({ kind: 'idle' });
  }, []);

  return { status, uploadFiles, dismiss };
};
