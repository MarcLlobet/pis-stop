import { useCallback, useEffect, useState } from 'react';

import type { EventRepository } from '../lib/repository';
import {
  type PhotoView,
  type ProfileView,
  type Snapshot,
  withPhoto,
  withProfile,
  withRating,
  withRound,
} from '../lib/snapshot';
import type { Rating, Round } from '../lib/types';

export type EventState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly snapshot: Snapshot };

export interface EventControls {
  readonly state: EventState;
  readonly reload: () => void;
  readonly addPhoto: (photo: PhotoView) => void;
  readonly addProfile: (profile: ProfileView) => void;
  readonly addRound: (round: Round) => void;
  readonly addRating: (rating: Rating) => void;
}

/** How often to ask for news while the app is on screen. One cheap request. */
const POLL_MS = 8_000;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Error desconegut';

const mapReady =
  (update: (snapshot: Snapshot) => Snapshot) =>
  (state: EventState): EventState =>
    state.status === 'ready' ? { status: 'ready', snapshot: update(state.snapshot) } : state;

export const useEvent = (repository: EventRepository | null): EventControls => {
  const [state, setState] = useState<EventState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (repository === null) {
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    repository.load().then(
      (snapshot) => {
        if (!controller.signal.aborted) {
          setState({ status: 'ready', snapshot });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', message: errorMessage(error) });
        }
      },
    );
    return () => {
      controller.abort();
    };
  }, [repository, attempt]);

  // Quietly pick up what others did (a vote opening, new photos) without the
  // loading screen: `poll` only downloads anything if something new arrived.
  useEffect(() => {
    if (repository === null || state.status !== 'ready') {
      return undefined;
    }
    const controller = new AbortController();
    const check = () => {
      if (document.hidden) {
        return;
      }
      repository.poll().then(
        (snapshot) => {
          if (snapshot !== null && !controller.signal.aborted) {
            setState({ status: 'ready', snapshot });
          }
        },
        () => undefined,
      );
    };
    const interval = setInterval(check, POLL_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, [repository, state.status]);

  const reload = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  const addPhoto = useCallback((photo: PhotoView) => {
    setState(mapReady((snapshot) => withPhoto(snapshot, photo)));
  }, []);

  const addProfile = useCallback((profile: ProfileView) => {
    setState(mapReady((snapshot) => withProfile(snapshot, profile)));
  }, []);

  const addRound = useCallback((round: Round) => {
    setState(mapReady((snapshot) => withRound(snapshot, round)));
  }, []);

  const addRating = useCallback((rating: Rating) => {
    setState(mapReady((snapshot) => withRating(snapshot, rating)));
  }, []);

  return { state, reload, addPhoto, addProfile, addRound, addRating };
};
