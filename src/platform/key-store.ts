import { asEventKeys, asIdentity, createMemoryKeyStore, type KeyStore } from '../lib/key-store';

const DATABASE = 'pis-stop';
const STORE = 'keys';
const VERSION = 1;
const EVENT_KEY = 'event';
const identityKey = (scope: string): string => `identity:${scope}`;

const settle = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.addEventListener('success', () => {
      resolve(request.result);
    });
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('IndexedDB request failed'));
    });
  });

const openDatabase = (): Promise<IDBDatabase> => {
  const request = indexedDB.open(DATABASE, VERSION);
  request.addEventListener('upgradeneeded', () => {
    request.result.createObjectStore(STORE);
  });
  return settle(request);
};

const run = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const database = await openDatabase();
  try {
    return await settle(operation(database.transaction(STORE, mode).objectStore(STORE)));
  } finally {
    database.close();
  }
};

const ignoreResult = (): void => undefined;

export const createIndexedDbKeyStore = (): KeyStore => ({
  loadEvent: async () => asEventKeys(await run('readonly', (store) => store.get(EVENT_KEY))),
  saveEvent: (keys) => run('readwrite', (store) => store.put(keys, EVENT_KEY)).then(ignoreResult),
  forgetEvent: () => run('readwrite', (store) => store.delete(EVENT_KEY)).then(ignoreResult),
  loadIdentity: async (scope) =>
    asIdentity(await run('readonly', (store) => store.get(identityKey(scope)))),
  saveIdentity: (scope, identity) =>
    run('readwrite', (store) => store.put(identity, identityKey(scope))).then(ignoreResult),
});

/** IndexedDB when it works, memory otherwise (the app then forgets on close). */
export const createBrowserKeyStore = async (): Promise<KeyStore> => {
  if (typeof indexedDB === 'undefined') {
    return createMemoryKeyStore();
  }
  try {
    await openDatabase().then((database) => {
      database.close();
    });
    return createIndexedDbKeyStore();
  } catch {
    return createMemoryKeyStore();
  }
};
