import { describe, expect, it } from 'vitest';

import { deriveEventKeys, generateSecret } from './crypto';
import { generateIdentity } from './identity';
import {
  asEventKeys,
  asIdentity,
  asInvite,
  asSavedEvents,
  createMemoryKeyStore,
  fromSingleEvent,
} from './key-store';

const organizer = 'DtOmq5V_9vWaljCkc9MafQ';

describe('createMemoryKeyStore', () => {
  it('saves and loads the event list', async () => {
    const store = createMemoryKeyStore();
    const keys = await deriveEventKeys(generateSecret(), 'org');
    expect(await store.loadEvents()).toEqual([]);
    await store.saveEvents([{ keys, invite: null, name: 'Correpisos' }]);
    expect(await store.loadEvents()).toEqual([{ keys, invite: null, name: 'Correpisos' }]);
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

describe('stored event list', () => {
  it('keeps well-formed events, drops the rest and duplicates', async () => {
    const keys = await deriveEventKeys(generateSecret(), 'org');
    const other = await deriveEventKeys(generateSecret(), 'org');
    const invite = { secret: generateSecret(), organizer };
    expect(
      asSavedEvents([
        { keys, invite, name: 'Correpisos' },
        { keys, invite: null, name: 'Duplicate' },
        { keys: other, invite: 'broken', name: 'x'.repeat(81) },
        { keys: { tag: 'a' } },
        null,
      ]),
    ).toEqual([
      { keys, invite, name: 'Correpisos' },
      { keys: other, invite: null, name: null },
    ]);
    expect(asSavedEvents('not a list')).toEqual([]);
  });

  it('reads what devices kept before there was a list', async () => {
    const keys = await deriveEventKeys(generateSecret(), 'org');
    const invite = { secret: generateSecret(), organizer };
    expect(fromSingleEvent(keys, invite)).toEqual([{ keys, invite, name: null }]);
    expect(fromSingleEvent(keys, undefined)).toEqual([{ keys, invite: null, name: null }]);
    expect(fromSingleEvent(undefined, invite)).toEqual([]);
  });
});
