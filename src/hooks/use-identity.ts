import { useCallback, useEffect, useState } from 'react';

import { generateIdentity, type Identity } from '../lib/identity';
import type { KeyStore } from '../lib/key-store';

export type IdentityState =
  { readonly status: 'loading' } | { readonly status: 'ready'; readonly identity: Identity | null };

/**
 * This device's signing identity for one event. The private key is created
 * non-extractable, so even code running in this page cannot copy it out.
 */
export const useIdentity = (
  keyStore: Promise<KeyStore>,
  scope: string,
  { autoCreate = false }: { readonly autoCreate?: boolean } = {},
) => {
  const [state, setState] = useState<IdentityState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    const create = async (store: KeyStore): Promise<Identity> => {
      const identity = await generateIdentity();
      await store.saveIdentity(scope, identity).catch(() => undefined);
      return identity;
    };
    void keyStore
      .then(async (store) => {
        const saved = await store.loadIdentity(scope).catch(() => null);
        return saved === null && autoCreate ? create(store) : saved;
      })
      .catch(() => null)
      .then((identity) => {
        if (!controller.signal.aborted) {
          setState({ status: 'ready', identity });
        }
      });
    return () => {
      controller.abort();
    };
  }, [keyStore, scope, autoCreate]);

  /** Returns the existing identity, or creates and stores a new one. */
  const ensure = useCallback(async (): Promise<Identity> => {
    if (state.status === 'ready' && state.identity !== null) {
      return state.identity;
    }
    const identity = await generateIdentity();
    await keyStore.then((store) => store.saveIdentity(scope, identity)).catch(() => undefined);
    setState({ status: 'ready', identity });
    return identity;
  }, [keyStore, scope, state]);

  return { state, ensure };
};
