import { PlusSquare, Share01 } from '@untitledui/icons';

import { Button } from '@/components/base/buttons/button';

import type { InstallPlatform } from '../hooks/use-install-prompt';

interface InstallHintProps {
  readonly eventName: string | null;
  readonly platform: InstallPlatform;
  /** `null` when no one-tap native prompt is offered: show instructions instead. */
  readonly install: (() => void) | null;
  readonly onContinue: () => void;
}

/** Shown once, before the first profile is created, never again on this device. */
export const InstallHint = ({ eventName, platform, install, onContinue }: InstallHintProps) => (
  <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-6 py-12">
    <header className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-brand-secondary">{eventName ?? 'Pis Stop'}</p>
      <h1 className="text-display-xs font-semibold text-primary">Abans de començar</h1>
      <p className="text-md text-tertiary">
        Instal·la-la al mòbil perquè et quedi com qualsevol altra app: amb icona pròpia, a pantalla
        completa, sense la barra del navegador.
      </p>
    </header>

    {install !== null ? (
      <Button
        size="xl"
        onPress={() => {
          install();
          onContinue();
        }}
      >
        Instal·la l’app
      </Button>
    ) : (
      <div className="flex items-start gap-3 rounded-xl bg-secondary p-4 text-sm text-secondary">
        {platform === 'ios' ? (
          <>
            <Share01 className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
            <p>
              Toca <strong>Compartir</strong> (la icona amb la fletxa cap amunt) i després{' '}
              <strong>Afegeix a la pantalla d’inici</strong>.
            </p>
          </>
        ) : (
          <>
            <PlusSquare className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
            <p>
              Obre el menú del navegador (⋮) i tria <strong>Instal·la l’app</strong> o{' '}
              <strong>Afegeix a la pantalla d’inici</strong>.
            </p>
          </>
        )}
      </div>
    )}

    <Button color="link-gray" size="md" onPress={onContinue}>
      Ara no, continua
    </Button>
  </main>
);
