import { AlertCircle, Download01 } from '@untitledui/icons';
import { useEffect, useState } from 'react';

import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import { Avatar } from '@/components/base/avatar/avatar';
import {
  CloseButton,
  sizes as closeButtonSizes,
  themes as closeButtonThemes,
} from '@/components/base/buttons/close-button';
import { cx } from '@/utils/cx';

import { formatTime, initialOf } from '../lib/format';
import { safetyCode } from '../lib/identity';
import type { PhotoView, Snapshot } from '../lib/snapshot';
import { FloatingPanel } from './floating-panel';

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
  const authorName = author?.name ?? 'Algú';

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

  return (
    <FloatingPanel label={`Foto de ${authorName}`} onClose={onClose} className="bg-primary-solid">
      <header className="flex items-center gap-3 p-4">
        <Avatar size="md" src={author?.avatarUrl ?? null} initials={initialOf(authorName)} alt="" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-md font-semibold text-white">
            {authorName}
            <span className="ml-2 font-mono text-xs text-quaternary_on-brand">
              {safetyCode(photo.authorId)}
            </span>
          </h2>
          <p className="truncate text-sm text-tertiary_on-brand">{formatTime(photo.takenAt)}</p>
        </div>
        {full.kind === 'ready' && (
          <a
            href={full.url}
            download={`pis-stop-${photo.id}.jpg`}
            aria-label="Descarrega la foto"
            className={cx(
              'flex shrink-0 cursor-pointer items-center justify-center rounded-lg transition duration-100 ease-linear focus:outline-hidden',
              closeButtonSizes.sm.root,
              closeButtonThemes.dark,
            )}
          >
            <Download01 className={cx('shrink-0', closeButtonSizes.sm.icon)} aria-hidden="true" />
          </a>
        )}
        <CloseButton label="Tanca" theme="dark" onPress={onClose} />
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-2 pt-0">
        {full.kind === 'ready' ? (
          <img
            src={full.url}
            alt={`Foto de ${authorName}`}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        ) : (
          <div className="relative">
            <img
              src={photo.thumbUrl}
              alt=""
              className="max-h-full max-w-full rounded-lg object-contain blur-sm"
            />
            <div className="absolute inset-0 flex items-center justify-center text-white">
              {full.kind === 'loading' ? (
                <LoadingIndicator type="line-spinner" size="sm" />
              ) : (
                <p role="alert" className="flex items-center gap-2 text-sm">
                  <AlertCircle className="size-5" aria-hidden="true" />
                  La foto original no ha passat la verificació
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </FloatingPanel>
  );
};
