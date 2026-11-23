import { Heading as AriaHeading } from 'react-aria-components';

import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal';
import { Badge } from '@/components/base/badges/badges';
import { CloseButton } from '@/components/base/buttons/close-button';

import { pluralize } from '../lib/format';
import type { PhotoView, ProfileView } from '../lib/snapshot';
import { PhotoGrid } from './photo-grid';

interface PhotoSheetProps {
  readonly title: string;
  readonly badge: string;
  readonly photos: readonly PhotoView[];
  readonly profiles: ReadonlyMap<string, ProfileView>;
  readonly empty: string;
  readonly onOpen: (photo: PhotoView) => void;
  readonly onClose: () => void;
}

/** A list of photos in a dialog. On phones it sits at the bottom, like a sheet. */
export const PhotoSheet = ({
  title,
  badge,
  photos,
  profiles,
  empty,
  onOpen,
  onClose,
}: PhotoSheetProps) => (
  <ModalOverlay
    isDismissable
    isOpen
    onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}
  >
    <Modal className="max-w-2xl">
      <Dialog className="flex flex-col gap-4 p-4 sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Badge type="pill-color" color="brand" size="sm">
              {badge}
            </Badge>
            <AriaHeading slot="title" className="text-lg font-semibold text-primary">
              {title}
            </AriaHeading>
            <p className="text-sm text-tertiary">{pluralize(photos.length, 'foto', 'fotos')}</p>
          </div>
          <CloseButton label="Tanca" onPress={onClose} />
        </header>
        <PhotoGrid photos={photos} profiles={profiles} onOpen={onOpen} empty={empty} />
      </Dialog>
    </Modal>
  </ModalOverlay>
);
