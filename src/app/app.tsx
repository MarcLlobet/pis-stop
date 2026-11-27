import { useMemo } from 'react';

import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';

import { type SessionState, useSession } from '../hooks/use-session';
import type { CloudinaryConfig } from '../lib/cloudinary';
import { type AblyConfig, parseAblyConfig, parseCloudinaryConfig } from '../lib/config';
import { browserKeyStore, clearLocationHash, readLocationHash } from '../platform/browser';
import { canScanQr } from '../platform/qr-scanner';
import { EventApp, type EventSource } from './event-app';
import type { EventSwitcher } from './events-sheet';
import { Landing } from './landing';

const cloudinary = parseCloudinaryConfig(import.meta.env);
const ably = parseAblyConfig(import.meta.env);

const NO_ACCOUNT =
  'Aquest enllaç és d’un correpisos, però aquesta web no té cap compte de fotos configurat.';

const toSource = (
  session: SessionState,
  config: CloudinaryConfig | null,
  ablyConfig: AblyConfig | null,
): EventSource | null => {
  switch (session.kind) {
    case 'resolving':
    case 'landing':
      return null;
    case 'demo':
      return { kind: 'demo' };
    case 'event':
      return config === null
        ? null
        : {
            kind: 'event',
            keys: session.keys,
            invite: session.invite,
            cloudinary: config,
            ably: ablyConfig,
          };
  }
};

export const App = () => {
  const { session, events, startDemo, join, switchTo, leave, rememberName } = useSession(
    browserKeyStore,
    readLocationHash,
    clearLocationHash,
    // `pnpm dev` opens the demo directly. Invites (#k=…) still work as usual.
    import.meta.env.DEV ? 'demo' : 'landing',
  );
  const source = useMemo(() => toSource(session, cloudinary, ably), [session]);
  const switcher = useMemo<EventSwitcher>(
    () => ({
      events,
      current: session.kind === 'event' ? session.keys.tag : null,
      canScan: canScanQr(),
      onSwitch: switchTo,
      onJoin: join,
    }),
    [events, session, switchTo, join],
  );

  if (session.kind === 'resolving') {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingIndicator type="line-spinner" size="md" />
      </div>
    );
  }
  if (source === null) {
    return (
      <Landing
        onJoin={join}
        canScan={switcher.canScan}
        // A deployment without a photo account is a demo; a real one shows nothing without an event.
        {...(cloudinary === null ? { onDemo: startDemo } : {})}
        {...(session.kind === 'event' ? { notice: NO_ACCOUNT } : {})}
      />
    );
  }
  return (
    <EventApp
      // A new event is a new app: identity, data and live location start over.
      key={source.kind === 'event' ? source.keys.tag : 'demo'}
      source={source}
      onLeave={leave}
      switcher={switcher}
      onEventName={rememberName}
    />
  );
};
