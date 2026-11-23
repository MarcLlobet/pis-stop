import { describe, expect, it } from 'vitest';

import { generateSecret } from '../lib/crypto';
import { toBase64Url } from '../lib/encoding';
import type { KeyValueStore } from '../lib/storage';
import { resolveSession } from './useSession';

const storeWith = (entries: Readonly<Record<string, string>>): KeyValueStore => ({
  get: (key) => entries[key] ?? null,
  set: () => undefined,
  remove: () => undefined,
});

describe('resolveSession', () => {
  it('shows the landing page without invite or memory', () => {
    expect(resolveSession('', storeWith({}))).toEqual({ kind: 'landing' });
  });

  it('opens the event from an invite link', () => {
    const secret = generateSecret();
    expect(resolveSession(`#k=${toBase64Url(secret)}`, storeWith({}))).toEqual({
      kind: 'event',
      secret,
      fromInvite: true,
    });
  });

  it('reopens a remembered event', () => {
    const secret = generateSecret();
    expect(resolveSession('', storeWith({ 'pis-stop:secret': toBase64Url(secret) }))).toEqual({
      kind: 'event',
      secret,
      fromInvite: false,
    });
  });

  it('prefers a new invite over the remembered event', () => {
    const remembered = generateSecret();
    const invited = generateSecret();
    const store = storeWith({ 'pis-stop:secret': toBase64Url(remembered) });
    expect(resolveSession(`#k=${toBase64Url(invited)}`, store)).toMatchObject({ secret: invited });
  });
});
