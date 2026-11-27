import { describe, expect, it } from 'vitest';

import { deriveEventKeys, generateSecret } from './crypto';
import { toBase64Url } from './encoding';
import type { Invite } from './invite';
import { createMemoryKeyStore, type KeyStore } from './key-store';
import { leaveEvent, nameEvent, openInvite, resolveSession, switchEvent } from './session';

const organizer = 'DtOmq5V_9vWaljCkc9MafQ';
const newInvite = (): Invite => ({ secret: generateSecret(), organizer });
const inviteHash = ({ secret }: Invite) => `#k=${toBase64Url(secret)}&o=${organizer}`;
const tagOf = async ({ secret }: Invite) => (await deriveEventKeys(secret, organizer)).tag;

describe('resolveSession', () => {
  it('shows the landing page without invite or saved events', async () => {
    expect(await resolveSession('', createMemoryKeyStore())).toEqual({
      session: { kind: 'landing' },
      events: [],
      fromInvite: false,
    });
  });

  it('opens the demo instead of the landing page when asked (development)', async () => {
    expect((await resolveSession('', createMemoryKeyStore(), 'demo')).session).toEqual({
      kind: 'demo',
    });
  });

  it('turns an invite into keys and remembers the event with its invite', async () => {
    const store = createMemoryKeyStore();
    const invite = newInvite();
    const { session, events, fromInvite } = await resolveSession(inviteHash(invite), store);
    const tag = await tagOf(invite);

    expect(fromInvite).toBe(true);
    expect(session.kind === 'event' && session.keys.tag).toBe(tag);
    expect(session.kind === 'event' && session.invite).toEqual(invite);
    expect(events).toEqual([{ tag, name: null }]);
    expect((await store.loadEvents())[0]?.invite).toEqual(invite);
  });

  it('reopens the last opened event, with its invite to share it', async () => {
    const store = createMemoryKeyStore();
    const opened = await openInvite(newInvite(), store);
    expect(await resolveSession('', store)).toEqual({ ...opened, fromInvite: false });
  });

  it('does not offer a saved invite that belongs to another event', async () => {
    const store = createMemoryKeyStore();
    const keys = await deriveEventKeys(generateSecret(), organizer);
    await store.saveEvents([{ keys, invite: newInvite(), name: null }]);
    expect((await resolveSession('', store)).session).toEqual({
      kind: 'event',
      keys,
      invite: null,
    });
    await store.saveEvents([
      { keys, invite: { secret: generateSecret(), organizer: 'A'.repeat(22) }, name: null },
    ]);
    expect((await resolveSession('', store)).session).toEqual({
      kind: 'event',
      keys,
      invite: null,
    });
  });

  it('still works when the key store fails', async () => {
    const broken: KeyStore = {
      ...createMemoryKeyStore(),
      loadEvents: () => Promise.reject(new Error('blocked')),
      saveEvents: () => Promise.reject(new Error('quota')),
    };
    expect((await resolveSession(inviteHash(newInvite()), broken)).session.kind).toBe('event');
    expect((await resolveSession('', broken)).session.kind).toBe('landing');
  });
});

describe('several events on one device', () => {
  const setup = async () => {
    const store = createMemoryKeyStore();
    const [first, second] = [newInvite(), newInvite()];
    await openInvite(first, store);
    await openInvite(second, store);
    return { store, first: await tagOf(first), second: await tagOf(second) };
  };

  it('keeps every joined event, the newest first', async () => {
    const { store, first, second } = await setup();
    const { events } = await resolveSession('', store);
    expect(events.map(({ tag }) => tag)).toEqual([second, first]);
  });

  it('moves an event to the front when it is joined again, keeping its name', async () => {
    const store = createMemoryKeyStore();
    const invite = newInvite();
    await openInvite(invite, store);
    await nameEvent(await tagOf(invite), 'Correpisos 2026', store);
    await openInvite(newInvite(), store);
    const { events } = await openInvite(invite, store);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ tag: await tagOf(invite), name: 'Correpisos 2026' });
  });

  it('switches to another event', async () => {
    const { store, first, second } = await setup();
    const { session, events } = await switchEvent(first, store);
    expect(session.kind === 'event' && session.keys.tag).toBe(first);
    expect(events.map(({ tag }) => tag)).toEqual([first, second]);
    expect((await resolveSession('', store)).events[0]?.tag).toBe(first);
  });

  it('ignores a switch to an unknown event', async () => {
    const { store, second } = await setup();
    const { session } = await switchEvent('ps_unknown', store);
    expect(session.kind === 'event' && session.keys.tag).toBe(second);
  });

  it('leaves one event and opens the next, then the fallback', async () => {
    const { store, first, second } = await setup();
    const next = await leaveEvent(second, store);
    expect(next.session.kind === 'event' && next.session.keys.tag).toBe(first);
    expect(next.events.map(({ tag }) => tag)).toEqual([first]);
    expect((await leaveEvent(first, store)).session).toEqual({ kind: 'landing' });
  });

  it('remembers names, and does not write when nothing changed', async () => {
    const { store, first } = await setup();
    expect((await nameEvent(first, 'Correpisos', store)).find(({ tag }) => tag === first)).toEqual({
      tag: first,
      name: 'Correpisos',
    });
    const readOnly: KeyStore = {
      ...store,
      saveEvents: () => Promise.reject(new Error('should not write')),
    };
    expect(
      (await nameEvent(first, 'Correpisos', readOnly)).find(({ tag }) => tag === first)?.name,
    ).toBe('Correpisos');
  });
});
