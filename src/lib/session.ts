import { deriveEventKeys, type EventKeys } from './crypto';
import { readInvite } from './invite';
import type { KeyStore } from './key-store';

export type Session =
  | { readonly kind: 'landing' }
  | { readonly kind: 'demo' }
  | { readonly kind: 'event'; readonly keys: EventKeys };

export interface ResolvedSession {
  readonly session: Session;
  /** True when the keys came from the URL, which must then be cleaned. */
  readonly fromInvite: boolean;
}

/** What to open when there is neither an invite nor a remembered event. */
export type Fallback = 'landing' | 'demo';

/**
 * An invite link always wins over a remembered event. The secret in the link
 * is turned into non-extractable keys right away and is not stored as such.
 */
export const resolveSession = async (
  hash: string,
  store: KeyStore,
  fallback: Fallback = 'landing',
): Promise<ResolvedSession> => {
  const invite = readInvite(hash);
  if (invite !== null) {
    const keys = await deriveEventKeys(invite.secret, invite.organizer);
    await store.saveEvent(keys).catch(() => undefined);
    return { session: { kind: 'event', keys }, fromInvite: true };
  }
  const keys = await store.loadEvent().catch(() => null);
  return {
    session: keys === null ? { kind: fallback } : { kind: 'event', keys },
    fromInvite: false,
  };
};
