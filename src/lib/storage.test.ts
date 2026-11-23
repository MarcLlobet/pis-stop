import { describe, expect, it, vi } from 'vitest';

import { generateSecret } from './crypto';
import {
  forgetSecret,
  fromWebStorage,
  type KeyValueStore,
  readProfileId,
  readSecret,
  saveProfileId,
  saveSecret,
} from './storage';

/** Minimal Web Storage double backed by an immutable snapshot. */
const fakeStorage = (): Storage => {
  const state: { items: ReadonlyMap<string, string> } = { items: new Map() };
  const replace = (items: ReadonlyMap<string, string>): void => {
    // eslint-disable-next-line functional/immutable-data -- test double
    state.items = items;
  };
  return {
    get length() {
      return state.items.size;
    },
    clear: () => replace(new Map()),
    key: (index) => [...state.items.keys()][index] ?? null,
    getItem: (key) => state.items.get(key) ?? null,
    setItem: (key, value) => replace(new Map([...state.items, [key, value]])),
    removeItem: (key) => replace(new Map([...state.items].filter(([k]) => k !== key))),
  };
};

const throwing = (): Storage => {
  throw new Error('SecurityError');
};

describe('fromWebStorage', () => {
  it('reads, writes and removes values', () => {
    const storage = fakeStorage();
    const store = fromWebStorage(() => storage);
    expect(store.get('a')).toBeNull();
    store.set('a', '1');
    expect(store.get('a')).toBe('1');
    store.remove('a');
    expect(store.get('a')).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    const store = fromWebStorage(throwing);
    expect(() => {
      store.set('a', '1');
      store.remove('a');
    }).not.toThrow();
    expect(store.get('a')).toBeNull();
  });
});

describe('session helpers', () => {
  const memory = (): KeyValueStore => {
    const storage = fakeStorage();
    return fromWebStorage(() => storage);
  };

  it('saves, reads and forgets the event secret', () => {
    const store = memory();
    const secret = generateSecret();
    expect(readSecret(store)).toBeNull();
    saveSecret(store, secret);
    expect(readSecret(store)).toEqual(secret);
    forgetSecret(store);
    expect(readSecret(store)).toBeNull();
  });

  it('ignores a corrupted secret', () => {
    const store = memory();
    store.set('pis-stop:secret', 'abc');
    expect(readSecret(store)).toBeNull();
  });

  it('remembers the profile per event', () => {
    const store = memory();
    saveProfileId(store, 'ps_a', 'me');
    expect(readProfileId(store, 'ps_a')).toBe('me');
    expect(readProfileId(store, 'ps_b')).toBeNull();
  });

  it('delegates to the provided storage', () => {
    const setItem = vi.fn();
    fromWebStorage(() => ({ ...fakeStorage(), setItem })).set('k', 'v');
    expect(setItem).toHaveBeenCalledWith('k', 'v');
  });
});
