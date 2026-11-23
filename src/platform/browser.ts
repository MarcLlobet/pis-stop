import type { RepositoryDeps } from '../lib/repository';
import type { ToImageUrl } from '../lib/snapshot';
import { createBrowserKeyStore } from './key-store';

/** Created once: IndexedDB when available, memory otherwise. */
export const browserKeyStore = createBrowserKeyStore();

export const toObjectUrl: ToImageUrl = (bytes, type) =>
  URL.createObjectURL(new Blob([bytes], { type }));

export const browserDeps: RepositoryDeps = {
  toUrl: toObjectUrl,
  newId: () => crypto.randomUUID(),
  now: () => new Date(),
};

export const readLocationHash = (): string => window.location.hash;

/** Removes the invite fragment so the secret does not stay in the address bar or history entry. */
export const clearLocationHash = (): void => {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
};

/** Untitled UI switches to dark mode with a `.dark-mode` class on the root. */
export const followSystemColorScheme = (): void => {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = (): void => {
    document.documentElement.classList.toggle('dark-mode', query.matches);
  };
  apply();
  query.addEventListener('change', apply);
};
