import { useCallback, useEffect, useState } from 'react';

import { readInviteSecret } from '../lib/invite';
import { forgetSecret, type KeyValueStore, readSecret, saveSecret } from '../lib/storage';
import type { Bytes } from '../lib/types';

export type Session =
  | { readonly kind: 'landing' }
  | { readonly kind: 'demo' }
  | { readonly kind: 'event'; readonly secret: Bytes; readonly fromInvite: boolean };

/** An invite link always wins over a remembered event. */
export const resolveSession = (hash: string, store: KeyValueStore): Session => {
  const invited = readInviteSecret(hash);
  if (invited !== null) {
    return { kind: 'event', secret: invited, fromInvite: true };
  }
  const remembered = readSecret(store);
  return remembered === null
    ? { kind: 'landing' }
    : { kind: 'event', secret: remembered, fromInvite: false };
};

export interface SessionControls {
  readonly session: Session;
  readonly startDemo: () => void;
  readonly leave: () => void;
}

export const useSession = (
  store: KeyValueStore,
  getHash: () => string,
  clearHash: () => void,
): SessionControls => {
  const [session, setSession] = useState<Session>(() => resolveSession(getHash(), store));

  useEffect(() => {
    if (session.kind === 'event' && session.fromInvite) {
      saveSecret(store, session.secret);
      clearHash();
    }
  }, [session, store, clearHash]);

  const startDemo = useCallback(() => {
    setSession({ kind: 'demo' });
  }, []);

  const leave = useCallback(() => {
    forgetSecret(store);
    setSession({ kind: 'landing' });
  }, [store]);

  return { session, startDemo, leave };
};
