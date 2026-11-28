import { useCallback, useState } from 'react';

import type { Identity } from '../lib/identity';
import { FULL_MAX_SIDE, THUMB_MAX_SIDE } from '../lib/image';
import type { EventRepository } from '../lib/repository';
import type { PhotoView } from '../lib/snapshot';
import { currentPosition } from '../platform/geolocation';
import { encodeImage } from '../platform/image';

export type UploadStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'uploading'; readonly done: number; readonly total: number }
  /** Uploaded: the originals stay at hand to keep a copy on the phone. */
  | { readonly kind: 'done'; readonly files: readonly File[] }
  | { readonly kind: 'error'; readonly message: string };

interface UploadOptions {
  readonly repository: EventRepository;
  readonly identity: Identity;
  readonly onPhoto: (photo: PhotoView) => void;
}

export const useUpload = ({ repository, identity, onPhoto }: UploadOptions) => {
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
        if (position === null) {
          // Without it, a photo cannot be placed on the map or tied to a
          // stop at all: better to refuse than to upload it unmoored.
          setStatus({
            kind: 'error',
            message: 'Activa la ubicació per pujar fotos: calen per saber on les vas fer.',
          });
          return;
        }
        // Sequential on purpose: phones on mobile data choke on parallel uploads.
        await files.reduce(async (previous, file, index) => {
          await previous;
          // Re-encoding also strips EXIF (GPS, camera serial) from the original.
          const [full, thumb] = await Promise.all([
            encodeImage(file, FULL_MAX_SIDE, 0.82),
            encodeImage(file, THUMB_MAX_SIDE, 0.72),
          ]);
          onPhoto(await repository.publishPhoto(identity, { position, full, thumb }));
          setStatus({ kind: 'uploading', done: index + 1, total });
        }, Promise.resolve());
        setStatus({ kind: 'done', files });
      } catch (error) {
        setStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'No s’ha pogut pujar la foto',
        });
      }
    },
    [repository, identity, onPhoto],
  );

  const dismiss = useCallback(() => {
    setStatus({ kind: 'idle' });
  }, []);

  return { status, uploadFiles, dismiss };
};
