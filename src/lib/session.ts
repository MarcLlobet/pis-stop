import { deriveEventKeys, type EventKeys } from './crypto';
import { type Invite, readInvite } from './invite';
import type { KeyStore, SavedEvent } from './key-store';

export type Session =
  | { readonly kind: 'landing' }
  | { readonly kind: 'demo' }
  | {
      readonly kind: 'event';
      readonly keys: EventKeys;
      /** To invite others from this device; `null` if it was not kept. */
      readonly invite: Invite | null;
    };

/** What the event list shows: nothing secret. */
export interface EventSummary {
  readonly tag: string;
  readonly name: string | null;
}

export interface SessionResult {
  readonly session: Session;
  /** Every event on this device, the open one first. */
  readonly events: readonly EventSummary[];
}

export interface ResolvedSession extends SessionResult {
  /** True when the keys came from the URL, which must then be cleaned. */
  readonly fromInvite: boolean;
}

/** What to open when there is neither an invite nor a remembered event. */
export type Fallback = 'landing' | 'demo';

const summaries = (events: readonly SavedEvent[]): readonly EventSummary[] =>
  events.map(({ keys, name }) => ({ tag: keys.tag, name }));

// Storage failures (private browsing, quota) only mean the app forgets sooner.
const load = (store: KeyStore): Promise<readonly SavedEvent[]> =>
  store.loadEvents().catch(() => []);

const save = (store: KeyStore, events: readonly SavedEvent[]): Promise<void> =>
  store.saveEvents(events).catch(() => undefined);

/** A saved invite is offered only if it really is the one of its event. */
const checkedInvite = async ({ keys, invite }: SavedEvent): Promise<Invite | null> => {
  if (invite?.organizer !== keys.organizer) {
    return null;
  }
  const derived = await deriveEventKeys(invite.secret, invite.organizer);
  return derived.tag === keys.tag ? invite : null;
};

/** Opens the first event of the list, or the fallback when there is none. */
const openFirst = async (
  events: readonly SavedEvent[],
  fallback: Fallback,
): Promise<SessionResult> => {
  const [first] = events;
  return {
    session:
      first === undefined
        ? { kind: fallback }
        : { kind: 'event', keys: first.keys, invite: await checkedInvite(first) },
    events: summaries(events),
  };
};

const withoutEvent = (events: readonly SavedEvent[], tag: string): readonly SavedEvent[] =>
  events.filter(({ keys }) => keys.tag !== tag);

/**
 * Joins the event of an invite (from the URL, a scanned QR or a pasted link)
 * and puts it first in this device's list. Joining an event again keeps its
 * remembered name.
 */
export const openInvite = async (invite: Invite, store: KeyStore): Promise<SessionResult> => {
  const keys = await deriveEventKeys(invite.secret, invite.organizer);
  const saved = await load(store);
  const name = saved.find((event) => event.keys.tag === keys.tag)?.name ?? null;
  const events = [{ keys, invite, name }, ...withoutEvent(saved, keys.tag)];
  await save(store, events);
  return { session: { kind: 'event', keys, invite }, events: summaries(events) };
};

/** An invite link always wins over the remembered events. */
export const resolveSession = async (
  hash: string,
  store: KeyStore,
  fallback: Fallback = 'landing',
): Promise<ResolvedSession> => {
  const invite = readInvite(hash);
  return invite === null
    ? { ...(await openFirst(await load(store), fallback)), fromInvite: false }
    : { ...(await openInvite(invite, store)), fromInvite: true };
};

/** Opens another joined event. An unknown tag leaves everything as it was. */
export const switchEvent = async (
  tag: string,
  store: KeyStore,
  fallback: Fallback = 'landing',
): Promise<SessionResult> => {
  const saved = await load(store);
  const target = saved.find(({ keys }) => keys.tag === tag);
  const events = target === undefined ? saved : [target, ...withoutEvent(saved, tag)];
  if (target !== undefined) {
    await save(store, events);
  }
  return openFirst(events, fallback);
};

/** Forgets one event on this device and opens the next one, if any. */
export const leaveEvent = async (
  tag: string,
  store: KeyStore,
  fallback: Fallback = 'landing',
): Promise<SessionResult> => {
  const events = withoutEvent(await load(store), tag);
  await save(store, events);
  return openFirst(events, fallback);
};

/** Remembers an event's name for the list. Unchanged names are not written again. */
export const nameEvent = async (
  tag: string,
  name: string,
  store: KeyStore,
): Promise<readonly EventSummary[]> => {
  const saved = await load(store);
  if (!saved.some((event) => event.keys.tag === tag && event.name !== name)) {
    return summaries(saved);
  }
  const events = saved.map((event) => (event.keys.tag === tag ? { ...event, name } : event));
  await save(store, events);
  return summaries(events);
};
