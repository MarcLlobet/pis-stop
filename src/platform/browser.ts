import type { RepositoryDeps } from '../lib/repository';
import type { ToImageUrl } from '../lib/snapshot';
import { fromWebStorage } from '../lib/storage';

export const browserStore = fromWebStorage(() => window.localStorage);

export const toObjectUrl: ToImageUrl = (bytes, type) =>
  URL.createObjectURL(new Blob([bytes], { type }));

export const browserDeps: RepositoryDeps = {
  toUrl: toObjectUrl,
  newId: () => crypto.randomUUID(),
  now: () => new Date(),
};

/** Removes the invite fragment so the secret does not linger in the address bar. */
export const clearLocationHash = (): void => {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
};
