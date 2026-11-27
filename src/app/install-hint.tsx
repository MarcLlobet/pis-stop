import { PlusSquare, Share01 } from '@untitledui/icons';

import { Button } from '@/components/base/buttons/button';

import type { InstallPlatform } from '../hooks/use-install-prompt';

interface InstallHintProps {
  readonly eventName: string | null;
  readonly platform: InstallPlatform;
  /** The install just finished: point to the new icon instead of going on in this tab. */
  readonly installed: boolean;
  /** `null` when no one-tap native prompt is offered: show instructions instead. */
  readonly install: (() => void) | null;
  readonly onContinue: () => void;
}

const Installed = ({
  eventName,
  onContinue,
}: Pick<InstallHintProps, 'eventName' | 'onContinue'>) => (
  <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-6 py-12">
    <header className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-brand-secondary">{eventName ?? 'Pis Stop'}</p>
      <h1 className="text-display-xs font-semibold text-primary">Ja la tens instal·lada</h1>
      <p className="text-md text-tertiary">
        Tanca aquesta pestanya i obre <strong>Pis Stop</strong> des de la icona de la pantalla
        d’inici. Si et demana el QR, escaneja’l des de dins de l’app.
      </p>
    </header>
    <Button color="link-gray" size="md" onPress={onContinue}>
      Continua aquí, al navegador
    </Button>
  </main>
);

/** Shown once, before the first profile is created, never again on this device. */
export const InstallHint = ({
  eventName,
  platform,
  installed,
  install,
  onContinue,
}: InstallHintProps) =>
  installed ? (
    <Installed eventName={eventName} onContinue={onContinue} />
  ) : (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-brand-secondary">{eventName ?? 'Pis Stop'}</p>
        <h1 className="text-display-xs font-semibold text-primary">Abans de començar</h1>
        <p className="text-md text-tertiary">
          Instal·la-la al mòbil perquè et quedi com qualsevol altra app: amb icona pròpia, a
          pantalla completa, sense la barra del navegador.
        </p>
      </header>

      {install !== null ? (
        <Button size="xl" onPress={install}>
          Instal·la l’app
        </Button>
      ) : (
        <div className="flex items-start gap-3 rounded-xl bg-secondary p-4 text-sm text-secondary">
          {platform === 'ios' ? (
            <>
              <Share01 className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
              <p>
                Toca <strong>Compartir</strong> (la icona amb la fletxa cap amunt) i després{' '}
                <strong>Afegeix a la pantalla d’inici</strong>. Després, obre-la des de la icona i
                entra-hi amb el QR (escanejant-lo des de dins de l’app).
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
