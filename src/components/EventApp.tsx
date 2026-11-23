import { useState } from 'react';

import { useEvent } from '../hooks/useEvent';
import { type RepositorySource, useRepository } from '../hooks/useRepository';
import { AVATAR_MAX_SIDE } from '../lib/image';
import { readProfileId, saveProfileId } from '../lib/storage';
import { browserDeps, browserStore } from '../platform/browser';
import { encodeImage } from '../platform/image';
import { EventScreen } from './EventScreen';
import { Onboarding, type OnboardingValues } from './Onboarding';
import { FullScreen, Spinner } from './Spinner';

interface EventAppProps {
  readonly source: RepositorySource;
  readonly onLeave: () => void;
}

export const EventApp = ({ source, onLeave }: EventAppProps) => {
  const resolved = useRepository(source, browserDeps);
  const { state, reload, addPhoto, addProfile } = useEvent(resolved?.repository ?? null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  if (resolved === null || state.status === 'loading') {
    return (
      <FullScreen>
        <span className="text-brand-600">
          <Spinner />
        </span>
        <p className="text-stone-600">Obrint el correpisos…</p>
      </FullScreen>
    );
  }

  if (state.status === 'error') {
    return (
      <FullScreen>
        <p role="alert" className="text-stone-700">
          No s’han pogut carregar les fotos ({state.message}).
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={reload}
            className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white"
          >
            Torna-ho a provar
          </button>
          <button type="button" onClick={onLeave} className="rounded-xl px-4 py-2 font-semibold">
            Surt
          </button>
        </div>
      </FullScreen>
    );
  }

  const { repository, scope } = resolved;
  const profileId = createdId ?? readProfileId(browserStore, scope);
  const me = profileId === null ? undefined : state.snapshot.profiles.get(profileId);

  const createProfile = async ({ name, email, avatar }: OnboardingValues) => {
    // Reusing the stored id turns a repeated onboarding into a profile update.
    const id = profileId ?? browserDeps.newId();
    const encoded = avatar === null ? null : await encodeImage(avatar, AVATAR_MAX_SIDE, 0.85);
    const profile = await repository.publishProfile({ id, name, email, avatar: encoded });
    saveProfileId(browserStore, scope, id);
    addProfile(profile);
    setCreatedId(id);
  };

  return me === undefined ? (
    <Onboarding eventName={state.snapshot.eventName} onSubmit={createProfile} />
  ) : (
    <EventScreen
      snapshot={state.snapshot}
      me={me}
      repository={repository}
      onPhoto={addPhoto}
      onReload={reload}
      onLeave={onLeave}
    />
  );
};
