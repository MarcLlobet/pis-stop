import { Camera01 } from '@untitledui/icons';
import { type SyntheticEvent, useEffect, useState } from 'react';
import { FileTrigger as AriaFileTrigger, Form as AriaForm } from 'react-aria-components';

import { Avatar } from '@/components/base/avatar/avatar';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';

import { initialOf } from '../lib/format';
import { currentPosition } from '../platform/geolocation';

export interface OnboardingValues {
  readonly name: string;
  readonly email: string;
  readonly avatar: File | null;
}

interface OnboardingProps {
  readonly eventName: string | null;
  readonly onSubmit: (values: OnboardingValues) => Promise<void>;
}

type Status =
  | { readonly kind: 'editing' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'error'; readonly message: string };

export const usePreview = (file: File | null): string | null => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (file === null) {
      setUrl(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);
  return url;
};

export const Onboarding = ({ eventName, onSubmit }: OnboardingProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'editing' });
  const preview = usePreview(avatar);
  const saving = status.kind === 'saving';

  // Asked once, here, rather than on the first upload: by then it is either
  // already granted or already refused, so uploading never stalls on it.
  useEffect(() => {
    void currentPosition();
  }, []);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus({ kind: 'saving' });
    try {
      await onSubmit({ name: name.trim(), email: email.trim(), avatar });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'No s’ha pogut desar el perfil',
      });
    }
  };

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-brand-secondary">{eventName ?? 'Pis Stop'}</p>
        <h1 className="text-display-xs font-semibold text-primary">Qui ets?</h1>
        <p className="text-md text-tertiary">Així la colla sabrà de qui és cada foto.</p>
      </header>

      <AriaForm
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <div className="flex items-center gap-4">
          <Avatar size="2xl" src={preview} initials={initialOf(name)} alt="" />
          <AriaFileTrigger
            acceptedFileTypes={['image/*']}
            defaultCamera="user"
            onSelect={(files) => {
              setAvatar(files?.[0] ?? null);
            }}
          >
            <Button color="secondary" size="md" iconLeading={Camera01}>
              {avatar === null ? 'Fes una foto' : 'Canvia la foto'}
            </Button>
          </AriaFileTrigger>
        </div>

        <Input
          isRequired
          label="Nom"
          name="name"
          autoComplete="nickname"
          maxLength={40}
          value={name}
          onChange={setName}
        />
        <Input
          isRequired
          label="Correu"
          type="email"
          name="email"
          autoComplete="email"
          hint="Només el veurà la colla."
          value={email}
          onChange={setEmail}
        />

        {status.kind === 'error' && (
          <p role="alert" className="text-sm text-error-primary">
            {status.message}
          </p>
        )}

        <Button type="submit" size="xl" isLoading={saving} isDisabled={name.trim() === ''}>
          Som-hi
        </Button>
      </AriaForm>
    </main>
  );
};
