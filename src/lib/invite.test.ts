import { describe, expect, it } from 'vitest';

import { generateSecret } from './crypto';
import { toBase64Url } from './encoding';
import { buildInviteUrl, readInvite } from './invite';

const organizer = 'DtOmq5V_9vWaljCkc9MafQ';

describe('invite links', () => {
  it('puts the secret and the organizer fingerprint in the fragment', () => {
    const secret = generateSecret();
    const url = new URL(
      buildInviteUrl('https://example.github.io/pis-stop/?x=1#old', { secret, organizer }),
    );
    expect(url.pathname).toBe('/pis-stop/');
    expect(url.search).toBe('');
    expect(readInvite(url.hash)).toEqual({ secret, organizer });
  });

  it('accepts a hash with or without the leading #', () => {
    const secret = generateSecret();
    expect(readInvite(`k=${toBase64Url(secret)}&o=${organizer}`)).toEqual({ secret, organizer });
  });

  it.each([
    ['an empty hash', ''],
    ['a missing organizer', `#k=${toBase64Url(new Uint8Array(32))}`],
    ['a malformed organizer', `#k=${toBase64Url(new Uint8Array(32))}&o=short`],
    ['a malformed secret', `#k=***&o=${organizer}`],
    ['a short secret', `#k=${toBase64Url(new Uint8Array(8))}&o=${organizer}`],
  ])('ignores %s', (_, hash) => {
    expect(readInvite(hash)).toBeNull();
  });
});
