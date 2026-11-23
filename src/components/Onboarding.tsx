import { type FormEvent, useEffect, useState } from 'react';

import { Avatar } from './Avatar';
import { Spinner } from './Spinner';

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

const usePreview = (file: File | null): string | null => {
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

const INPUT =
  'mt-1 block w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-stone-900 shadow-sm ring-1 ring-stone-300 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-600';

export const Onboarding = ({ eventName, onSubmit }: OnboardingProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'editing' });
  const preview = usePreview(avatar);
  const saving = status.kind === 'saving';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
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
      <header className="space-y-2">
        <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">
          {eventName ?? 'Pis Stop'}
        </p>
        <h1 className="text-3xl font-black tracking-tight">Qui ets?</h1>
        <p className="text-stone-600">Així la colla sabrà de qui és cada foto.</p>
      </header>

      <form
        className="space-y-5"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <label className="flex cursor-pointer items-center gap-4">
          <Avatar name={name} url={preview} size="lg" />
          <span className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm ring-1 ring-stone-300 hover:bg-stone-50">
            {avatar === null ? 'Tria una foto de perfil' : 'Canvia la foto'}
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              setAvatar(event.currentTarget.files?.[0] ?? null);
            }}
          />
        </label>

        <label className="block text-sm font-medium text-stone-700">
          Nom
          <input
            required
            name="name"
            autoComplete="nickname"
            maxLength={40}
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value);
            }}
            className={INPUT}
          />
        </label>

        <label className="block text-sm font-medium text-stone-700">
          Correu
          <input
            required
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.currentTarget.value);
            }}
            className={INPUT}
          />
        </label>

        {status.kind === 'error' && (
          <p role="alert" className="text-sm text-red-700">
            {status.message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || name.trim() === ''}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
        >
          {saving && <Spinner />}
          {saving ? 'Desant…' : 'Som-hi'}
        </button>
      </form>
    </main>
  );
};
