import { useCallback, useEffect, useState } from 'react';

import type { EventRepository } from '../lib/repository';
import {
  type PhotoView,
  type ProfileView,
  type Snapshot,
  withPhoto,
  withProfile,
} from '../lib/snapshot';

export type EventState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly snapshot: Snapshot };

export interface EventControls {
  readonly state: EventState;
  readonly reload: () => void;
  readonly addPhoto: (photo: PhotoView) => void;
  readonly addProfile: (profile: ProfileView) => void;
}

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

  const reload = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  const addPhoto = useCallback((photo: PhotoView) => {
    setState(mapReady((snapshot) => withPhoto(snapshot, photo)));
  }, []);

  const addProfile = useCallback((profile: ProfileView) => {
    setState(mapReady((snapshot) => withProfile(snapshot, profile)));
  }, []);

  return { state, reload, addPhoto, addProfile };
};
