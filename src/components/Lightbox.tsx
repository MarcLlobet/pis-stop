import { useEffect, useState } from 'react';

import { formatTime } from '../lib/format';
import type { PhotoView, Snapshot } from '../lib/snapshot';
import { Avatar } from './Avatar';
import { Spinner } from './Spinner';

interface LightboxProps {
  readonly photo: PhotoView;
  readonly snapshot: Snapshot;
  readonly openPhoto: (photo: PhotoView) => Promise<string>;
  readonly onClose: () => void;
}

type FullImage =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly url: string }
  | { readonly kind: 'error' };

export const Lightbox = ({ photo, snapshot, openPhoto, onClose }: LightboxProps) => {
  const [full, setFull] = useState<FullImage>({ kind: 'loading' });
  const author = snapshot.profiles.get(photo.authorId);
  const stop = snapshot.stops.find(({ id }) => id === photo.stopId);

  useEffect(() => {
    const controller = new AbortController();
    setFull({ kind: 'loading' });
    openPhoto(photo).then(
      (url) => {
        if (!controller.signal.aborted) {
          setFull({ kind: 'ready', url });
        }
      },
      () => {
        if (!controller.signal.aborted) {
          setFull({ kind: 'error' });
        }
      },
    );
    return () => {
      controller.abort();
    };
  }, [photo, openPhoto]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Foto"
      className="fixed inset-0 z-[2000] flex flex-col bg-stone-950/95 text-white"
    >
      <header className="flex items-center gap-3 p-4">
        <Avatar name={author?.name ?? '?'} url={author?.avatarUrl ?? null} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{author?.name ?? 'Algú'}</p>
          <p className="truncate text-sm text-stone-400">
            {[stop?.name, formatTime(photo.takenAt)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold hover:bg-white/20"
        >
          Tanca
        </button>
      </header>
      <div className="flex flex-1 items-center justify-center overflow-hidden p-2">
        {full.kind === 'ready' ? (
          <img src={full.url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        ) : (
          <div className="relative">
            <img
              src={photo.thumbUrl}
              alt=""
              className="max-h-[70vh] max-w-full rounded-lg object-contain blur-sm"
            />
            <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm">
              {full.kind === 'loading' ? <Spinner /> : 'No s’ha pogut obrir la foto original'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
