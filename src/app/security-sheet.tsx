import {
  AlertTriangle,
  ChevronDown,
  Eye,
  Fingerprint04,
  Lock01,
  NavigationPointer01,
  ShieldTick,
} from '@untitledui/icons';
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

interface Topic {
  readonly icon: FC<{ className?: string }>;
  readonly title: string;
  readonly body: string;
}

/** Condensed, non-technical version of SECURITY.md, one topic per toggle. */
const TOPICS: readonly Topic[] = [
  {
    icon: Lock01,
    title: 'Com es xifren les fotos',
    body: 'Cada foto es xifra en aquest mateix mòbil (AES-256-GCM) abans de pujar-se. El servidor (Cloudinary) només guarda blocs de bytes aleatoris: no té la clau per llegir-los, encara que algú hi tingués accés d’administrador.',
  },
  {
    icon: Fingerprint04,
    title: 'Les signatures',
    body: 'La teva clau de signatura no surt mai d’aquest mòbil. Cada foto que puges queda signada amb ella, i l’app comprova la signatura en carregar: ningú pot penjar-ne en nom teu, ni tan sols algú altre del grup amb la mateixa clau compartida.',
  },
  {
    icon: Eye,
    title: 'Qui pot veure què',
    body: 'Qui té l’enllaç o el QR veu la ruta i totes les fotos, i el pot passar a algú altre (el botó Convida ho fa més fàcil). Sense el QR, l’app no ensenya res. Cloudinary veu que existeixen fitxers, quan es pugen i des de quina IP, però no el contingut. Si teniu ubicació en viu activada, Ably veu que algú s’ha connectat i amb quina freqüència, mai on és.',
  },
  {
    icon: NavigationPointer01,
    title: 'La ubicació en viu',
    body: 'És opcional i es xifra exactament igual que una foto. Només la veuen els qui també l’han activada en aquell moment, i no es guarda enlloc: viu només a la memòria de cada mòbil mentre dura la sessió.',
  },
  {
    icon: AlertTriangle,
    title: 'Els límits',
    body: 'Qui té l’enllaç ho té tot (totes les fotos, pot penjar-ne): no hi ha manera d’expulsar algú sense crear un event nou. Les hores de les fotos les posa el mòbil de qui les penja. Cap sistema és perfecte: el document complet explica cada límit conegut, sense maquillatge.',
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
        <ul className="flex flex-col divide-y divide-secondary rounded-xl ring-1 ring-secondary">
          {TOPICS.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <details className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-3 outline-focus-ring marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
                  <Icon className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                  <span className="flex-1 text-sm font-semibold text-primary">{title}</span>
                  <ChevronDown
                    className="size-4 shrink-0 text-fg-quaternary transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-2 pl-8 text-sm text-tertiary">{body}</p>
              </details>
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
