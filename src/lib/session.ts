import { deriveEventKeys, type EventKeys } from './crypto';
import { type Invite, readInvite } from './invite';
import type { KeyStore } from './key-store';

export type Session =
  | { readonly kind: 'landing' }
  | { readonly kind: 'demo' }
  | {
      readonly kind: 'event';
      readonly keys: EventKeys;
      /** To invite others from this device; `null` if it was not kept. */
      readonly invite: Invite | null;
    };

export interface ResolvedSession {
  readonly session: Session;
  /** True when the keys came from the URL, which must then be cleaned. */
  readonly fromInvite: boolean;
}

/** What to open when there is neither an invite nor a remembered event. */
export type Fallback = 'landing' | 'demo';

/**
 * Joins the event of an invite (from the URL, a scanned QR or a pasted link)
 * and remembers it on this device. Storage failures only mean that the app
 * will ask for the invite again next time.
 */
export const openInvite = async (invite: Invite, store: KeyStore): Promise<Session> => {
  const keys = await deriveEventKeys(invite.secret, invite.organizer);
  await Promise.all([store.saveEvent(keys), store.saveInvite(invite)]).catch(() => undefined);
  return { kind: 'event', keys, invite };
};

/** The saved invite, but only if it really is the one of the saved event. */
const savedInviteFor = async (keys: EventKeys, store: KeyStore): Promise<Invite | null> => {
  const invite = await store.loadInvite().catch(() => null);
  if (invite?.organizer !== keys.organizer) {
    return null;
  }
  const derived = await deriveEventKeys(invite.secret, invite.organizer);
  return derived.tag === keys.tag ? invite : null;
};

/** An invite link always wins over a remembered event. */
export const resolveSession = async (
  hash: string,
  store: KeyStore,
  fallback: Fallback = 'landing',
): Promise<ResolvedSession> => {
  const invite = readInvite(hash);
  if (invite !== null) {
    return { session: await openInvite(invite, store), fromInvite: true };
  }
  const keys = await store.loadEvent().catch(() => null);
  return {
    session:
      keys === null
        ? { kind: fallback }
        : { kind: 'event', keys, invite: await savedInviteFor(keys, store) },
    fromInvite: false,
  };
};
