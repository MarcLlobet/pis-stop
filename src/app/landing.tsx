import { Lock01, QrCode01 } from '@untitledui/icons';
import { type SyntheticEvent, useState } from 'react';
import { Form as AriaForm } from 'react-aria-components';

import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';

import { type Invite, readInviteText } from '../lib/invite';
import { QrScannerSheet } from './qr-scanner-sheet';

interface LandingProps {
  readonly onJoin: (invite: Invite) => void;
  /** Whether this browser can read a QR with the camera inside the app. */
  readonly canScan: boolean;
  /** Only on a demo-only deployment (no photo account configured). */
  readonly onDemo?: () => void;
  readonly notice?: string;
}

const INVALID =
  'Aquest enllaç no és una invitació de Pis Stop. Copia’l sencer, amb el que hi ha després del #.';

/** Without an event there is nothing to see: this page only lets you join one. */
export const Landing = ({ onJoin, canScan, onDemo, notice }: LandingProps) => {
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invite = readInviteText(link);
    if (invite === null) {
      setError(INVALID);
      return;
    }
    onJoin(invite);
  };

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <FeaturedIcon icon={Lock01} color="brand" theme="gradient" size="lg" />
        <div className="flex flex-col gap-2">
          <h1 className="text-display-sm font-semibold text-primary">Pis Stop</h1>
          <p className="text-lg text-tertiary">
            Necessites un event per fer servir Pis Stop. Demana el QR a qui organitza el correpisos.
          </p>
        </div>
      </header>

      {notice !== undefined && (
        <p
          role="alert"
          className="rounded-xl bg-warning-primary p-4 text-sm text-warning-primary ring-1 ring-secondary"
        >
          {notice}
        </p>
      )}

      {canScan ? (
        <Button
          size="xl"
          iconLeading={QrCode01}
          onPress={() => {
            setScanning(true);
          }}
        >
          Escaneja el QR
        </Button>
      ) : (
        <p className="text-md text-secondary">
          Obre el QR amb la càmera del mòbil i entraràs directament.
        </p>
      )}

      <AriaForm className="flex flex-col gap-3" onSubmit={submit}>
        <Input
          label="O enganxa l’enllaç d’invitació"
          name="invite"
          autoComplete="off"
          placeholder="https://…/pis-stop/#k=…"
          value={link}
          onChange={(value) => {
            setLink(value);
            setError(null);
          }}
          {...(error === null ? {} : { isInvalid: true, hint: error })}
        />
        <Button type="submit" size="lg" color="secondary" isDisabled={link.trim() === ''}>
          Entra
        </Button>
      </AriaForm>

      {onDemo !== undefined && (
        <Button size="lg" color="link-gray" onPress={onDemo}>
          Prova la demo
        </Button>
      )}

      {scanning && (
        <QrScannerSheet
          onScan={onJoin}
          onClose={() => {
            setScanning(false);
          }}
        />
      )}
    </main>
  );
};
