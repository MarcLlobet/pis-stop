import { AlertTriangle, Copy01, Share01 } from '@untitledui/icons';
import { useState } from 'react';
import { Heading as AriaHeading } from 'react-aria-components';

import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal';
import { Button } from '@/components/base/buttons/button';
import { CloseButton } from '@/components/base/buttons/close-button';

import { QrCode } from './qr-code';

interface InviteSheetProps {
  readonly eventName: string | null;
  /** The full invite link, secret included. */
  readonly inviteUrl: string;
  readonly onClose: () => void;
}

type CopyState = 'idle' | 'copied' | 'failed';

const canShare = (): boolean => typeof navigator !== 'undefined' && 'share' in navigator;

/** Lets someone already in the event bring someone else in: QR, share sheet or copy. */
export const InviteSheet = ({ eventName, inviteUrl, onClose }: InviteSheetProps) => {
  const [copy, setCopy] = useState<CopyState>('idle');
  const name = eventName ?? 'Correpisos';

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl).then(
      () => {
        setCopy('copied');
      },
      () => {
        setCopy('failed');
      },
    );
  };

  const shareLink = () => {
    // Cancelling the share sheet rejects too: nothing to report.
    navigator.share({ title: `Pis Stop – ${name}`, url: inviteUrl }).catch(() => undefined);
  };

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
        <Dialog className="flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <AriaHeading slot="title" className="text-lg font-semibold text-primary">
                Convida al correpisos
              </AriaHeading>
              <p className="text-sm text-tertiary">{name}</p>
            </div>
            <CloseButton label="Tanca" onPress={onClose} />
          </div>

          <QrCode text={inviteUrl} label={`QR d’invitació a ${name}`} />

          <div className="flex flex-col gap-3">
            {canShare() && (
              <Button size="lg" iconLeading={Share01} onPress={shareLink}>
                Comparteix l’enllaç
              </Button>
            )}
            <Button size="lg" color="secondary" iconLeading={Copy01} onPress={copyLink}>
              {copy === 'copied' ? 'Copiat!' : 'Copia l’enllaç'}
            </Button>
            {copy === 'failed' && (
              <p role="alert" className="text-sm text-error-primary">
                No s’ha pogut copiar. Fes servir el QR o el botó de compartir.
              </p>
            )}
          </div>

          <p className="flex gap-3 rounded-xl bg-warning-primary p-4 text-sm text-warning-primary ring-1 ring-secondary">
            <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
            Aquest QR és la clau del grup: qui el tingui podrà veure la ruta i totes les fotos, i
            penjar-ne. Comparteix-lo només amb la colla.
          </p>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
