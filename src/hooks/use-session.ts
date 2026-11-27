import { useCallback, useEffect, useState } from 'react';

import type { Invite } from '../lib/invite';
import type { KeyStore } from '../lib/key-store';
import { type Fallback, openInvite, resolveSession, type Session } from '../lib/session';

export type SessionState = { readonly kind: 'resolving' } | Session;

export interface SessionControls {
  readonly session: SessionState;
  readonly startDemo: () => void;
  /** Joins the event of a scanned or pasted invite. */
  readonly join: (invite: Invite) => void;
  readonly leave: () => void;
}

export const useSession = (
  keyStore: Promise<KeyStore>,
  readHash: () => string,
  clearHash: () => void,
  fallback: Fallback = 'landing',
): SessionControls => {
  const [session, setSession] = useState<SessionState>({ kind: 'resolving' });

  useEffect(() => {
    const controller = new AbortController();
    void keyStore
      .then((store) => resolveSession(readHash(), store, fallback))
      .then(({ session: resolved, fromInvite }) => {
        if (fromInvite) {
          clearHash();
        }
        if (!controller.signal.aborted) {
          setSession(resolved);
        }
      });
    return () => {
      controller.abort();
    };
  }, [keyStore, readHash, clearHash, fallback]);

  const startDemo = useCallback(() => {
    setSession({ kind: 'demo' });
  }, []);

  const join = useCallback(
    (invite: Invite) => {
      void keyStore.then((store) => openInvite(invite, store)).then(setSession);
    },
    [keyStore],
  );

  const leave = useCallback(() => {
    void keyStore.then((store) => store.forgetEvent());
    setSession({ kind: fallback });
  }, [keyStore, fallback]);

  return { session, startDemo, join, leave };
};
