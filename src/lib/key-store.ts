import { type EventKeys, SECRET_BYTES } from './crypto';
import type { Identity } from './identity';
import { type Invite, isFingerprint } from './invite';

/**
 * Where this device keeps its keys. In the browser it is IndexedDB, which can
 * store CryptoKey objects as they are: non-extractable keys stay
 * non-extractable, so page scripts can use them but can never read them out.
 */
/** One event this device has joined. */
export interface SavedEvent {
  readonly keys: EventKeys;
  /**
   * The invite itself (the group secret), kept so this device can show the
   * QR to someone else. Unlike `keys.aes`, it is readable by the page.
   */
  readonly invite: Invite | null;
  /** The event's name, remembered for the event list; `null` until first loaded. */
  readonly name: string | null;
}

export interface KeyStore {
  /** Every joined event, the most recently opened first. */
  readonly loadEvents: () => Promise<readonly SavedEvent[]>;
  readonly saveEvents: (events: readonly SavedEvent[]) => Promise<void>;
  /** One identity per event, so profiles cannot be linked across groups. */
  readonly loadIdentity: (scope: string) => Promise<Identity | null>;
  readonly saveIdentity: (scope: string, identity: Identity) => Promise<void>;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

const isCryptoKey = (value: unknown): value is CryptoKey =>
  typeof CryptoKey !== 'undefined' && value instanceof CryptoKey;

/** Stored values are re-validated on the way out, like everything else. */
export const asEventKeys = (value: unknown): EventKeys | null =>
  isRecord(value) &&
  typeof value['tag'] === 'string' &&
  typeof value['organizer'] === 'string' &&
  isCryptoKey(value['aes'])
    ? { tag: value['tag'], organizer: value['organizer'], aes: value['aes'] }
    : null;

export const asInvite = (value: unknown): Invite | null =>
  isRecord(value) &&
  value['secret'] instanceof Uint8Array &&
  value['secret'].length === SECRET_BYTES &&
  typeof value['organizer'] === 'string' &&
  isFingerprint(value['organizer'])
    ? { secret: new Uint8Array(value['secret']), organizer: value['organizer'] }
    : null;

const NAME_LENGTH = 80;

const asName = (value: unknown): string | null =>
  typeof value === 'string' && value.length <= NAME_LENGTH ? value : null;

const asSavedEvent = (value: unknown): SavedEvent | null => {
  const keys = isRecord(value) ? asEventKeys(value['keys']) : null;
  return isRecord(value) && keys !== null
    ? { keys, invite: asInvite(value['invite']), name: asName(value['name']) }
    : null;
};

/** The stored event list, minus anything malformed and duplicated events. */
export const asSavedEvents = (value: unknown): readonly SavedEvent[] =>
  Array.isArray(value)
    ? value
        .map(asSavedEvent)
        .filter((event): event is SavedEvent => event !== null)
        .filter(
          (event, index, all) =>
            all.findIndex((other) => other.keys.tag === event.keys.tag) === index,
        )
    : [];

/** Devices that joined before the event list existed kept one event and one invite. */
export const fromSingleEvent = (event: unknown, invite: unknown): readonly SavedEvent[] => {
  const keys = asEventKeys(event);
  return keys === null ? [] : [{ keys, invite: asInvite(invite), name: null }];
};

export const asIdentity = (value: unknown): Identity | null =>
  isRecord(value) &&
  typeof value['id'] === 'string' &&
  typeof value['publicKey'] === 'string' &&
  isCryptoKey(value['privateKey'])
    ? { id: value['id'], publicKey: value['publicKey'], privateKey: value['privateKey'] }
    : null;

/**
 * In-memory store: used in tests and as the fallback when IndexedDB is not
 * available (some private browsing modes). Keys then last until the tab closes.
 */
export const createMemoryKeyStore = (): KeyStore => {
  const state: {
    events: readonly SavedEvent[];
    identities: ReadonlyMap<string, Identity>;
  } = { events: [], identities: new Map() };
  /* eslint-disable functional/immutable-data -- the single mutable cell of this store */
  return {
    loadEvents: () => Promise.resolve(state.events),
    saveEvents: (events) => {
      state.events = events;
      return Promise.resolve();
    },
    loadIdentity: (scope) => Promise.resolve(state.identities.get(scope) ?? null),
    saveIdentity: (scope, identity) => {
      state.identities = new Map([...state.identities, [scope, identity]]);
      return Promise.resolve();
    },
  };
  /* eslint-enable functional/immutable-data */
};
