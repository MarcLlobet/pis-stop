import { CheckCircle, Fingerprint04, Lock01, ShieldTick } from '@untitledui/icons';
import type { FC } from 'react';
import { Heading as AriaHeading } from 'react-aria-components';

import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal';
import { CloseButton } from '@/components/base/buttons/close-button';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';

import { safetyCode } from '../lib/identity';
import type { ProfileView } from '../lib/snapshot';

interface SecuritySheetProps {
  readonly me: ProfileView;
  readonly onClose: () => void;
}

const FACTS: readonly { readonly icon: FC<{ className?: string }>; readonly text: string }[] = [
  {
    icon: Lock01,
    text: 'Les fotos es xifren en aquest mòbil (AES-256-GCM) abans de pujar. El servidor només guarda soroll.',
  },
  {
    icon: Fingerprint04,
    text: 'Cada foto va signada amb la teva clau, que no surt mai d’aquest mòbil. Ningú pot penjar en nom teu.',
  },
  {
    icon: CheckCircle,
    text: 'Tot el que veus s’ha verificat: el que no està ben signat no es mostra.',
  },
];

/** In-app summary of SECURITY.md, plus the user's safety code. */
export const SecuritySheet = ({ me, onClose }: SecuritySheetProps) => (
  <ModalOverlay
    isDismissable
    isOpen
    onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}
  >
    <Modal className="max-w-md">
      <Dialog className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between">
          <FeaturedIcon icon={ShieldTick} color="success" theme="light" size="lg" />
          <CloseButton label="Tanca" onPress={onClose} />
        </div>
        <AriaHeading slot="title" className="text-lg font-semibold text-primary">
          Com es protegeixen les fotos
        </AriaHeading>
        <ul className="flex flex-col gap-4">
          {FACTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 text-sm text-tertiary">
              <Icon className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
        <div className="rounded-xl bg-secondary p-4">
          <p className="text-sm text-tertiary">El teu codi de seguretat</p>
          <p className="font-mono text-display-xs font-semibold tracking-widest text-primary">
            {safetyCode(me.id)}
          </p>
          <p className="mt-1 text-xs text-tertiary">
            Si algú dubta que una foto és teva, compareu aquest codi en persona: el veuen al costat
            del teu nom.
          </p>
        </div>
        <a
          href="https://github.com/MarcLlobet/pis-stop/blob/main/SECURITY.md"
          target="_blank"
          rel="noreferrer noopener"
          className="text-sm font-semibold text-brand-secondary underline"
        >
          Llegeix l’auditoria completa
        </a>
      </Dialog>
    </Modal>
  </ModalOverlay>
);
