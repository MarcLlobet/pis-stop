import { type EventKeys, SECRET_BYTES } from './crypto';
import type { Identity } from './identity';
import { type Invite, isFingerprint } from './invite';

/**
 * Where this device keeps its keys. In the browser it is IndexedDB, which can
 * store CryptoKey objects as they are: non-extractable keys stay
 * non-extractable, so page scripts can use them but can never read them out.
 */
export interface KeyStore {
  readonly loadEvent: () => Promise<EventKeys | null>;
  readonly saveEvent: (keys: EventKeys) => Promise<void>;
  /**
   * The invite itself (the group secret), kept so this device can show the
   * QR to someone else. Unlike `aes`, it is readable by the page.
   */
  readonly loadInvite: () => Promise<Invite | null>;
  readonly saveInvite: (invite: Invite) => Promise<void>;
  /** Forgets the event keys and the invite. */
  readonly forgetEvent: () => Promise<void>;
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
    event: EventKeys | null;
    invite: Invite | null;
    identities: ReadonlyMap<string, Identity>;
  } = { event: null, invite: null, identities: new Map() };
  /* eslint-disable functional/immutable-data -- the single mutable cell of this store */
  return {
    loadEvent: () => Promise.resolve(state.event),
    saveEvent: (keys) => {
      state.event = keys;
      return Promise.resolve();
    },
    loadInvite: () => Promise.resolve(state.invite),
    saveInvite: (invite) => {
      state.invite = invite;
      return Promise.resolve();
    },
    forgetEvent: () => {
      state.event = null;
      state.invite = null;
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
