import { useMemo } from 'react';

import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';

import { useSession } from '../hooks/use-session';
import { parseCloudinaryConfig } from '../lib/config';
import { browserKeyStore, clearLocationHash, readLocationHash } from '../platform/browser';
import { EventApp, type EventSource } from './event-app';
import { Landing } from './landing';
import type { SessionState } from '../hooks/use-session';
import type { CloudinaryConfig } from '../lib/cloudinary';

const cloudinary = parseCloudinaryConfig(import.meta.env);

const NO_ACCOUNT =
  'Aquest enllaç és d’un correpisos, però aquesta web no té cap compte de fotos configurat.';

const toSource = (session: SessionState, config: CloudinaryConfig | null): EventSource | null => {
  switch (session.kind) {
    case 'resolving':
    case 'landing':
      return null;
    case 'demo':
      return { kind: 'demo' };
    case 'event':
      return config === null ? null : { kind: 'event', keys: session.keys, cloudinary: config };
  }
};

export const App = () => {
  const { session, startDemo, leave } = useSession(
    browserKeyStore,
    readLocationHash,
    clearLocationHash,
  );
  const source = useMemo(() => toSource(session, cloudinary), [session]);

  if (session.kind === 'resolving') {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingIndicator type="line-spinner" size="md" />
      </div>
    );
  }
  if (source === null) {
    return (
      <Landing onDemo={startDemo} {...(session.kind === 'event' ? { notice: NO_ACCOUNT } : {})} />
    );
  }
  return <EventApp source={source} onLeave={leave} />;
};
