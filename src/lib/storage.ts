import { SECRET_BYTES } from './crypto';
import { fromBase64Url, toBase64Url } from './encoding';
import type { Bytes } from './types';

export interface KeyValueStore {
  readonly get: (key: string) => string | null;
  readonly set: (key: string, value: string) => void;
  readonly remove: (key: string) => void;
}

/**
 * Web Storage can be missing or throw (private mode, blocked cookies). The app
 * keeps working; it simply forgets between visits.
 */
export const fromWebStorage = (getStorage: () => Storage): KeyValueStore => ({
  get: (key) => {
    try {
      return getStorage().getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      getStorage().setItem(key, value);
    } catch {
      // Ignored on purpose: persistence is a convenience.
    }
  },
  remove: (key) => {
    try {
      getStorage().removeItem(key);
    } catch {
      // Ignored on purpose: persistence is a convenience.
    }
  },
});

const SECRET_KEY = 'pis-stop:secret';
const profileKey = (tag: string): string => `pis-stop:profile:${tag}`;

export const readSecret = (store: KeyValueStore): Bytes | null => {
  const secret = fromBase64Url(store.get(SECRET_KEY) ?? '');
  return secret?.length === SECRET_BYTES ? secret : null;
};

export const saveSecret = (store: KeyValueStore, secret: Bytes): void => {
  store.set(SECRET_KEY, toBase64Url(secret));
};

export const forgetSecret = (store: KeyValueStore): void => {
  store.remove(SECRET_KEY);
};

export const readProfileId = (store: KeyValueStore, tag: string): string | null =>
  store.get(profileKey(tag));

export const saveProfileId = (store: KeyValueStore, tag: string, id: string): void => {
  store.set(profileKey(tag), id);
};
