import { Heading as AriaHeading } from 'react-aria-components';

import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal';
import { Badge } from '@/components/base/badges/badges';
import { CloseButton } from '@/components/base/buttons/close-button';

import { pluralize } from '../lib/format';
import { photosOfStop } from '../lib/selectors';
import type { PhotoView, Snapshot } from '../lib/snapshot';
import type { Stop } from '../lib/types';
import { PhotoGrid } from './photo-grid';

interface StopSheetProps {
  readonly stop: Stop;
  readonly snapshot: Snapshot;
  readonly onOpen: (photo: PhotoView) => void;
  readonly onClose: () => void;
}

/** On phones the Untitled UI modal sits at the bottom, like a sheet. */
export const StopSheet = ({ stop, snapshot, onOpen, onClose }: StopSheetProps) => {
  const photos = photosOfStop(snapshot.photos, stop.id);
  return (
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
                Parada {stop.order}
              </Badge>
              <AriaHeading slot="title" className="text-lg font-semibold text-primary">
                {stop.name}
              </AriaHeading>
              <p className="text-sm text-tertiary">{pluralize(photos.length, 'foto', 'fotos')}</p>
            </div>
            <CloseButton label="Tanca" onPress={onClose} />
          </header>
          <PhotoGrid
            photos={photos}
            profiles={snapshot.profiles}
            onOpen={onOpen}
            empty="Encara ningú ha penjat res aquí."
          />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
