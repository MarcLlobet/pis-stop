import { useCallback, useEffect, useState } from 'react';

import type { Invite } from '../lib/invite';
import type { KeyStore } from '../lib/key-store';
import {
  type EventSummary,
  type Fallback,
  leaveEvent,
  nameEvent,
  openInvite,
  resolveSession,
  type Session,
  type SessionResult,
  switchEvent,
} from '../lib/session';

export type SessionState = { readonly kind: 'resolving' } | Session;

export interface SessionControls {
  readonly session: SessionState;
  /** Every event on this device, the open one first. */
  readonly events: readonly EventSummary[];
  readonly startDemo: () => void;
  /** Joins the event of a scanned or pasted invite. */
  readonly join: (invite: Invite) => void;
  readonly switchTo: (tag: string) => void;
  /** Forgets the open event on this device and opens the next one. */
  readonly leave: () => void;
  /** Remembers the open event's name for the event list. */
  readonly rememberName: (name: string) => void;
}

export const useSession = (
  keyStore: Promise<KeyStore>,
  readHash: () => string,
  clearHash: () => void,
  fallback: Fallback = 'landing',
): SessionControls => {
  const [session, setSession] = useState<SessionState>({ kind: 'resolving' });
  const [events, setEvents] = useState<readonly EventSummary[]>([]);

  const apply = useCallback((result: SessionResult) => {
    setSession(result.session);
    setEvents(result.events);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void keyStore
      .then((store) => resolveSession(readHash(), store, fallback))
      .then(({ fromInvite, ...result }) => {
        if (fromInvite) {
          clearHash();
        }
        if (!controller.signal.aborted) {
          apply(result);
        }
      });
    return () => {
      controller.abort();
    };
  }, [keyStore, readHash, clearHash, fallback, apply]);

  const startDemo = useCallback(() => {
    setSession({ kind: 'demo' });
  }, []);

  const join = useCallback(
    (invite: Invite) => {
      void keyStore.then((store) => openInvite(invite, store)).then(apply);
    },
    [keyStore, apply],
  );

  const switchTo = useCallback(
    (tag: string) => {
      void keyStore.then((store) => switchEvent(tag, store, fallback)).then(apply);
    },
    [keyStore, fallback, apply],
  );

  const openTag = session.kind === 'event' ? session.keys.tag : null;

  const leave = useCallback(() => {
    if (openTag === null) {
      setSession({ kind: fallback });
      return;
    }
    void keyStore.then((store) => leaveEvent(openTag, store, fallback)).then(apply);
  }, [keyStore, fallback, apply, openTag]);

  const rememberName = useCallback(
    (name: string) => {
      if (openTag !== null) {
        void keyStore.then((store) => nameEvent(openTag, name, store)).then(setEvents);
      }
    },
    [keyStore, openTag],
  );

  return { session, events, startDemo, join, switchTo, leave, rememberName };
};
