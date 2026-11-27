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
import { useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';

import { CloseButton } from '@/components/base/buttons/close-button';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';
import { cx } from '@/utils/cx';

import { safetyCode } from '../lib/identity';
import type { ProfileView } from '../lib/snapshot';
import { FloatingPanel } from './floating-panel';

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

/**
 * In-app summary of SECURITY.md, plus the user's safety code. A panel over
 * the map, like `PhotoSheet`/`Lightbox` — not a dismissable `ModalOverlay`:
 * that pattern's "click outside to close" detection has a known conflict
 * with interactive toggles inside (the topics below), closing the whole
 * sheet instead of just expanding one.
 */
export const SecuritySheet = ({ me, onClose }: SecuritySheetProps) => {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (title: string) => {
    setOpen((current) =>
      current.has(title)
        ? new Set([...current].filter((item) => item !== title))
        : new Set([...current, title]),
    );
  };

  return (
    <FloatingPanel label="Com es protegeixen les fotos" onClose={onClose} className="bg-primary">
      <header className="flex items-start justify-between gap-4 p-4 pb-0 sm:p-6 sm:pb-0">
        <div className="flex flex-col gap-2">
          <FeaturedIcon icon={ShieldTick} color="success" theme="light" size="lg" />
          <h2 className="text-lg font-semibold text-primary">Com es protegeixen les fotos</h2>
        </div>
        <CloseButton label="Tanca" onPress={onClose} />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6">
        <ul className="flex flex-col divide-y divide-secondary rounded-xl ring-1 ring-secondary">
          {TOPICS.map(({ icon: Icon, title, body }) => {
            const isOpen = open.has(title);
            return (
              <li key={title} className="px-4 py-3">
                <AriaButton
                  onPress={() => {
                    toggle(title);
                  }}
                  aria-expanded={isOpen}
                  className="flex w-full cursor-pointer items-center gap-3 text-left outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <Icon className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                  <span className="flex-1 text-sm font-semibold text-primary">{title}</span>
                  <ChevronDown
                    className={cx(
                      'size-4 shrink-0 text-fg-quaternary transition-transform',
                      isOpen && 'rotate-180',
                    )}
                    aria-hidden="true"
                  />
                </AriaButton>
                {isOpen && <p className="mt-2 pl-8 text-sm text-tertiary">{body}</p>}
              </li>
            );
          })}
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
      </div>
    </FloatingPanel>
  );
};
