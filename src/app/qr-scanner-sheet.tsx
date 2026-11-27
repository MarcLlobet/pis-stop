import { useEffect, useRef, useState } from 'react';
import { Heading as AriaHeading } from 'react-aria-components';

import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal';
import { CloseButton } from '@/components/base/buttons/close-button';

import { type Invite, readInviteText } from '../lib/invite';
import { scanQr } from '../platform/qr-scanner';

interface QrScannerSheetProps {
  readonly onScan: (invite: Invite) => void;
  readonly onClose: () => void;
}

const isInvite = (text: string): boolean => readInviteText(text) !== null;

/** Camera view that closes itself as soon as it sees a Pis Stop invite. */
export const QrScannerSheet = ({ onScan, onClose }: QrScannerSheetProps) => {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = video.current;
    if (element === null) {
      return undefined;
    }
    const controller = new AbortController();
    scanQr(element, isInvite, controller.signal).then(
      (text) => {
        const invite = text === null ? null : readInviteText(text);
        if (invite !== null) {
          onScan(invite);
        }
      },
      () => {
        if (!controller.signal.aborted) {
          setError(
            'No s’ha pogut obrir la càmera. Dona-li permís, o obre el QR amb la càmera del mòbil.',
          );
        }
      },
    );
    return () => {
      controller.abort();
    };
  }, [onScan]);

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
      <Modal className="max-w-sm">
        <Dialog className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <AriaHeading slot="title" className="text-lg font-semibold text-primary">
              Escaneja el QR de l’event
            </AriaHeading>
            <CloseButton label="Tanca" onPress={onClose} />
          </div>
          <video
            ref={video}
            muted
            playsInline
            aria-label="Càmera"
            className="aspect-square w-full rounded-xl bg-black object-cover"
          />
          {error === null ? (
            <p className="text-sm text-tertiary">
              Apunta al QR que t’han passat. La imatge no surt del mòbil.
            </p>
          ) : (
            <p role="alert" className="text-sm text-error-primary">
              {error}
            </p>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
