import { describe, expect, it } from 'vitest';

import { deriveEventKeys, generateSecret } from './crypto';
import { generateIdentity } from './identity';
import { asEventKeys, asIdentity, asInvite, createMemoryKeyStore } from './key-store';

const organizer = 'DtOmq5V_9vWaljCkc9MafQ';

describe('createMemoryKeyStore', () => {
  it('saves, loads and forgets the event keys', async () => {
    const store = createMemoryKeyStore();
    const keys = await deriveEventKeys(generateSecret(), 'org');
    expect(await store.loadEvent()).toBeNull();
    await store.saveEvent(keys);
    expect(await store.loadEvent()).toBe(keys);
    await store.forgetEvent();
    expect(await store.loadEvent()).toBeNull();
  });

  it('keeps the invite until the event is forgotten', async () => {
    const store = createMemoryKeyStore();
    const invite = { secret: generateSecret(), organizer };
    expect(await store.loadInvite()).toBeNull();
    await store.saveInvite(invite);
    expect(await store.loadInvite()).toBe(invite);
    await store.forgetEvent();
    expect(await store.loadInvite()).toBeNull();
  });

  it('keeps one identity per event', async () => {
    const store = createMemoryKeyStore();
    const a = await generateIdentity();
    const b = await generateIdentity();
    await store.saveIdentity('ps_a', a);
    await store.saveIdentity('ps_b', b);
    expect(await store.loadIdentity('ps_a')).toBe(a);
    expect(await store.loadIdentity('ps_b')).toBe(b);
    expect(await store.loadIdentity('ps_c')).toBeNull();
  });
});

describe('stored value validation', () => {
  it('accepts well-formed values', async () => {
    const keys = await deriveEventKeys(generateSecret(), 'org');
    const identity = await generateIdentity();
    expect(asEventKeys(keys)).toEqual(keys);
    expect(asIdentity(identity)).toEqual(identity);
  });

  it.each([null, 'x', { tag: 'a', organizer: 'b', aes: 'not a key' }, { id: 'a' }])(
    'rejects %j',
    (value) => {
      expect(asEventKeys(value)).toBeNull();
      expect(asIdentity(value)).toBeNull();
      expect(asInvite(value)).toBeNull();
    },
  );

  it('accepts a well-formed invite', () => {
    const invite = { secret: generateSecret(), organizer };
    expect(asInvite(invite)).toEqual(invite);
  });

  it.each([
    ['a short secret', { secret: new Uint8Array(8), organizer }],
    ['a secret that is not bytes', { secret: 'x'.repeat(43), organizer }],
    ['a malformed organizer', { secret: new Uint8Array(32), organizer: 'short' }],
    ['a missing organizer', { secret: new Uint8Array(32) }],
  ])('rejects an invite with %s', (_, value) => {
    expect(asInvite(value)).toBeNull();
  });
});
