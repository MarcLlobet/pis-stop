import { AlertCircle } from '@untitledui/icons';
import { type ReactNode, useMemo } from 'react';

import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import { Button } from '@/components/base/buttons/button';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';

import { useEvent } from '../hooks/use-event';
import { useIdentity } from '../hooks/use-identity';
import { useInstallPrompt } from '../hooks/use-install-prompt';
import { useLiveLocation } from '../hooks/use-live-location';
import { useLocalEvent } from '../hooks/use-local-event';
import { type CloudinaryConfig, createCloudinaryClient } from '../lib/cloudinary';
import type { AblyConfig } from '../lib/config';
import type { EventKeys } from '../lib/crypto';
import { createDemoRepository } from '../lib/demo';
import { AVATAR_MAX_SIDE } from '../lib/image';
import type { Invite } from '../lib/invite';
import { createCloudinaryRepository } from '../lib/repository';
import { browserDeps, browserKeyStore } from '../platform/browser';
import { encodeImage } from '../platform/image';
import { EventScreen } from './event-screen';
import { InstallHint } from './install-hint';
import { Onboarding, type OnboardingValues } from './onboarding';

export type EventSource =
  | { readonly kind: 'demo' }
  | {
      readonly kind: 'event';
      readonly keys: EventKeys;
      /** Kept on this device so it can invite others; `null` if it was not. */
      readonly invite: Invite | null;
      readonly cloudinary: CloudinaryConfig;
      /** `null` without an Ably account: live location sharing stays hidden. */
      readonly ably: AblyConfig | null;
    };

interface EventAppProps {
  readonly source: EventSource;
  readonly onLeave: () => void;
}

const Centered = ({ children }: { readonly children: ReactNode }) => (
  <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
    {children}
  </div>
);

/** In development the demo skips onboarding: you land on the map with a profile. */
const DEV_PROFILE_NAME = 'Tu (dev)';

export const EventApp = ({ source, onLeave }: EventAppProps) => {
  const autoProfile = source.kind === 'demo' && import.meta.env.DEV;
  const scope = source.kind === 'demo' ? 'demo' : source.keys.tag;
  const identity = useIdentity(browserKeyStore, scope, { autoCreate: autoProfile });
  const devIdentity =
    autoProfile && identity.state.status === 'ready' ? identity.state.identity : null;
  // In development the demo shows the real route from event.json, if present.
  const localEvent = useLocalEvent(autoProfile);

  const repository = useMemo(() => {
    if (source.kind === 'event') {
      return createCloudinaryRepository(
        createCloudinaryClient(source.cloudinary),
        source.keys,
        browserDeps,
      );
    }
    if (!autoProfile) {
      return createDemoRepository(browserDeps);
    }
    // Wait for the identity and event.json, so the first load is already complete.
    return devIdentity === null || localEvent === undefined
      ? null
      : createDemoRepository(
          browserDeps,
          { identity: devIdentity, name: DEV_PROFILE_NAME },
          localEvent ?? undefined,
        );
  }, [source, autoProfile, devIdentity, localEvent]);
  const { state, reload, addPhoto, addProfile } = useEvent(repository);

  // Hooks run unconditionally, before the loading/error returns below, so
  // live location updates as soon as the profile list and identity are ready.
  const mine = identity.state.status === 'ready' ? identity.state.identity : null;
  const install = useInstallPrompt();
  const live = useLiveLocation({
    config: source.kind === 'event' ? source.ably : null,
    keys: source.kind === 'event' ? source.keys : null,
    identity: mine,
    profiles: state.status === 'ready' ? state.snapshot.profiles : null,
  });

  if (repository === null || state.status === 'loading' || identity.state.status === 'loading') {
    return (
      <Centered>
        <LoadingIndicator type="line-spinner" size="md" label="Obrint i verificant les fotos…" />
      </Centered>
    );
  }

  if (state.status === 'error') {
    return (
      <Centered>
        <FeaturedIcon icon={AlertCircle} color="error" theme="light" size="lg" />
        <p role="alert" className="text-md text-secondary">
          No s’han pogut carregar les fotos ({state.message}).
        </p>
        <div className="flex gap-3">
          <Button onPress={reload}>Torna-ho a provar</Button>
          <Button color="secondary" onPress={onLeave}>
            Surt
          </Button>
        </div>
      </Centered>
    );
  }

  const me = mine === null ? undefined : state.snapshot.profiles.get(mine.id);

  const createProfile = async ({ name, email, avatar }: OnboardingValues) => {
    const signer = await identity.ensure();
    const encoded = avatar === null ? null : await encodeImage(avatar, AVATAR_MAX_SIDE, 0.85);
    addProfile(await repository.publishProfile(signer, { name, email, avatar: encoded }));
  };

  return mine === null || me === undefined ? (
    install.show ? (
      <InstallHint
        eventName={state.snapshot.eventName}
        platform={install.platform}
        install={install.install}
        onContinue={install.dismiss}
      />
    ) : (
      <Onboarding eventName={state.snapshot.eventName} onSubmit={createProfile} />
    )
  ) : (
    <EventScreen
      snapshot={state.snapshot}
      me={me}
      identity={mine}
      repository={repository}
      onPhoto={addPhoto}
      onReload={reload}
      onLeave={onLeave}
      live={live}
      invite={source.kind === 'event' ? source.invite : null}
    />
  );
};
