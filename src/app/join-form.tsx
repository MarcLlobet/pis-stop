import { QrCode01 } from '@untitledui/icons';
import { type SyntheticEvent, useState } from 'react';
import { Form as AriaForm } from 'react-aria-components';

import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';

import { type Invite, readInviteText } from '../lib/invite';
import { QrScannerSheet } from './qr-scanner-sheet';

interface JoinFormProps {
  readonly onJoin: (invite: Invite) => void;
  /** Whether this browser can read a QR with the camera inside the app. */
  readonly canScan: boolean;
}

const INVALID =
  'Aquest enllaç no és una invitació de Pis Stop. Copia’l sencer, amb el que hi ha després del #.';

/** The two ways into an event from inside the app: scan its QR, or paste its link. */
export const JoinForm = ({ onJoin, canScan }: JoinFormProps) => {
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
    <div className="flex flex-col gap-6">
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

      {scanning && (
        <QrScannerSheet
          onScan={onJoin}
          onClose={() => {
            setScanning(false);
          }}
        />
      )}
    </div>
  );
};
