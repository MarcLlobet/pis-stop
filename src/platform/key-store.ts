import {
  asIdentity,
  asSavedEvents,
  createMemoryKeyStore,
  fromSingleEvent,
  type KeyStore,
} from '../lib/key-store';

const DATABASE = 'pis-stop';
const STORE = 'keys';
const VERSION = 1;
const EVENTS_KEY = 'events';
/** Before the event list: one event and its invite. Read once, then replaced. */
const LEGACY_EVENT_KEY = 'event';
const LEGACY_INVITE_KEY = 'invite';
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

const LEGACY_KEYS = [LEGACY_EVENT_KEY, LEGACY_INVITE_KEY] as const;

const read = (key: string): Promise<unknown> => run('readonly', (store) => store.get(key));

const remove = (key: string): Promise<undefined> => run('readwrite', (store) => store.delete(key));

export const createIndexedDbKeyStore = (): KeyStore => ({
  loadEvents: async () => {
    const events = await read(EVENTS_KEY);
    if (events !== undefined) {
      return asSavedEvents(events);
    }
    const [event, invite] = await Promise.all(LEGACY_KEYS.map(read));
    return fromSingleEvent(event, invite);
  },
  saveEvents: async (events) => {
    await run('readwrite', (store) => store.put(events, EVENTS_KEY));
    await Promise.all(LEGACY_KEYS.map(remove));
  },
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
