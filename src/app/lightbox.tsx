import { AlertCircle } from '@untitledui/icons';
import { useEffect, useState } from 'react';
import { Heading as AriaHeading } from 'react-aria-components';

import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal';
import { Avatar } from '@/components/base/avatar/avatar';
import { CloseButton } from '@/components/base/buttons/close-button';

import { formatTime, initialOf } from '../lib/format';
import { safetyCode } from '../lib/identity';
import type { PhotoView, Snapshot } from '../lib/snapshot';

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

  return (
    <ModalOverlay
      isDismissable
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      className="bg-overlay/90"
    >
      <Modal className="max-w-3xl bg-primary-solid">
        <Dialog className="flex flex-col">
          <header className="flex items-center gap-3 p-4">
            <Avatar
              size="md"
              src={author?.avatarUrl ?? null}
              initials={initialOf(authorName)}
              alt=""
            />
            <div className="min-w-0 flex-1">
              <AriaHeading slot="title" className="truncate text-md font-semibold text-white">
                {authorName}
                <span className="ml-2 font-mono text-xs text-quaternary_on-brand">
                  {safetyCode(photo.authorId)}
                </span>
              </AriaHeading>
              <p className="truncate text-sm text-tertiary_on-brand">
                {[stop?.name, formatTime(photo.takenAt)].filter(Boolean).join(' · ')}
              </p>
            </div>
            <CloseButton label="Tanca" theme="dark" onPress={onClose} />
          </header>
          <div className="flex min-h-64 items-center justify-center p-2 pt-0">
            {full.kind === 'ready' ? (
              <img
                src={full.url}
                alt={`Foto de ${authorName}`}
                className="max-h-[75dvh] max-w-full rounded-lg object-contain"
              />
            ) : (
              <div className="relative">
                <img
                  src={photo.thumbUrl}
                  alt=""
                  className="max-h-[75dvh] max-w-full rounded-lg object-contain blur-sm"
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
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
