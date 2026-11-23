import { describe, expect, it } from 'vitest';

import { deriveEventKeys, generateSecret } from './crypto';
import { generateIdentity } from './identity';
import { asEventKeys, asIdentity, createMemoryKeyStore } from './key-store';

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
    },
  );
});
