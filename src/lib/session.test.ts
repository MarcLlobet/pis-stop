import { describe, expect, it } from 'vitest';

import { deriveEventKeys, generateSecret } from './crypto';
import { toBase64Url } from './encoding';
import { createMemoryKeyStore, type KeyStore } from './key-store';
import { openInvite, resolveSession } from './session';

const organizer = 'DtOmq5V_9vWaljCkc9MafQ';
const inviteHash = (secret: Uint8Array) => `#k=${toBase64Url(secret)}&o=${organizer}`;

describe('resolveSession', () => {
  it('shows the landing page without invite or saved keys', async () => {
    expect(await resolveSession('', createMemoryKeyStore())).toEqual({
      session: { kind: 'landing' },
      fromInvite: false,
    });
  });

  it('turns an invite into keys and remembers them', async () => {
    const store = createMemoryKeyStore();
    const secret = generateSecret();
    const { session, fromInvite } = await resolveSession(inviteHash(secret), store);
    const expected = await deriveEventKeys(secret, organizer);

    expect(fromInvite).toBe(true);
    expect(session.kind === 'event' && session.keys.tag).toBe(expected.tag);
    expect((await store.loadEvent())?.tag).toBe(expected.tag);
    expect(session.kind === 'event' && session.invite).toEqual({ secret, organizer });
    expect(await store.loadInvite()).toEqual({ secret, organizer });
  });

  it('reopens the saved event with its invite, to share it', async () => {
    const store = createMemoryKeyStore();
    const invite = { secret: generateSecret(), organizer };
    const opened = await openInvite(invite, store);
    expect(await resolveSession('', store)).toEqual({ session: opened, fromInvite: false });
    expect(opened.kind === 'event' && opened.invite).toBe(invite);
  });

  it('does not offer a saved invite that belongs to another event', async () => {
    const store = createMemoryKeyStore();
    const keys = await deriveEventKeys(generateSecret(), organizer);
    await store.saveEvent(keys);
    await store.saveInvite({ secret: generateSecret(), organizer });
    expect((await resolveSession('', store)).session).toEqual({
      kind: 'event',
      keys,
      invite: null,
    });
    await store.saveInvite({ secret: generateSecret(), organizer: 'AAAAAAAAAAAAAAAAAAAAAA' });
    expect((await resolveSession('', store)).session).toEqual({
      kind: 'event',
      keys,
      invite: null,
    });
  });

  it('reopens the saved event', async () => {
    const store = createMemoryKeyStore();
    const keys = await deriveEventKeys(generateSecret(), organizer);
    await store.saveEvent(keys);
    expect(await resolveSession('', store)).toEqual({
      session: { kind: 'event', keys, invite: null },
      fromInvite: false,
    });
  });

  it('prefers a new invite over the saved event', async () => {
    const store = createMemoryKeyStore();
    await store.saveEvent(await deriveEventKeys(generateSecret(), organizer));
    const secret = generateSecret();
    const { session } = await resolveSession(inviteHash(secret), store);
    const expected = await deriveEventKeys(secret, organizer);
    expect(session.kind === 'event' && session.keys.tag).toBe(expected.tag);
  });

  it('still works when the key store fails', async () => {
    const broken: KeyStore = {
      ...createMemoryKeyStore(),
      saveEvent: () => Promise.reject(new Error('quota')),
      loadEvent: () => Promise.reject(new Error('blocked')),
      saveInvite: () => Promise.reject(new Error('quota')),
    };
    expect((await resolveSession(inviteHash(generateSecret()), broken)).session.kind).toBe('event');
    expect((await resolveSession('', broken)).session.kind).toBe('landing');
  });

  it('still opens the saved event when its invite cannot be read', async () => {
    const memory = createMemoryKeyStore();
    const keys = await deriveEventKeys(generateSecret(), organizer);
    await memory.saveEvent(keys);
    const store: KeyStore = { ...memory, loadInvite: () => Promise.reject(new Error('blocked')) };
    expect((await resolveSession('', store)).session).toEqual({
      kind: 'event',
      keys,
      invite: null,
    });
  });

  it('opens the demo instead of the landing page when asked (development)', async () => {
    expect((await resolveSession('', createMemoryKeyStore(), 'demo')).session).toEqual({
      kind: 'demo',
    });
  });
});
