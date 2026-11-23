import { useCallback, useEffect, useState } from 'react';

import type { KeyStore } from '../lib/key-store';
import { resolveSession, type Session } from '../lib/session';

export type SessionState = { readonly kind: 'resolving' } | Session;

export interface SessionControls {
  readonly session: SessionState;
  readonly startDemo: () => void;
  readonly leave: () => void;
}

export const useSession = (
  keyStore: Promise<KeyStore>,
  readHash: () => string,
  clearHash: () => void,
): SessionControls => {
  const [session, setSession] = useState<SessionState>({ kind: 'resolving' });

  useEffect(() => {
    const controller = new AbortController();
    void keyStore
      .then((store) => resolveSession(readHash(), store))
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
  }, [keyStore, readHash, clearHash]);

  const startDemo = useCallback(() => {
    setSession({ kind: 'demo' });
  }, []);

  const leave = useCallback(() => {
    void keyStore.then((store) => store.forgetEvent());
    setSession({ kind: 'landing' });
  }, [keyStore]);

  return { session, startDemo, leave };
};
