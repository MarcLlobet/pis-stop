import { useMemo } from 'react';

import { EventApp } from './components/EventApp';
import { Landing } from './components/Landing';
import { type Session, useSession } from './hooks/useSession';
import type { RepositorySource } from './hooks/useRepository';
import type { CloudinaryConfig } from './lib/cloudinary';
import { parseCloudinaryConfig } from './lib/config';
import { browserStore, clearLocationHash } from './platform/browser';

const cloudinary = parseCloudinaryConfig(import.meta.env);
const getHash = (): string => window.location.hash;

const NO_ACCOUNT =
  'Aquest enllaç és d’un correpisos, però aquesta web no té cap compte de fotos configurat.';

const toSource = (session: Session, config: CloudinaryConfig | null): RepositorySource | null => {
  switch (session.kind) {
    case 'landing':
      return null;
    case 'demo':
      return { kind: 'demo' };
    case 'event':
      return config === null ? null : { kind: 'event', secret: session.secret, cloudinary: config };
  }
};

export const App = () => {
  const { session, startDemo, leave } = useSession(browserStore, getHash, clearLocationHash);
  const source = useMemo(() => toSource(session, cloudinary), [session]);

  if (source === null) {
    return (
      <Landing onDemo={startDemo} {...(session.kind === 'event' ? { notice: NO_ACCOUNT } : {})} />
    );
  }
  return <EventApp source={source} onLeave={leave} />;
};
