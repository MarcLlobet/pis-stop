import { describe, expect, it } from 'vitest';

import { generateSecret } from './crypto';
import { toBase64Url } from './encoding';
import { buildInviteUrl, readInviteSecret } from './invite';

describe('invite links', () => {
  it('puts the secret in the fragment and reads it back', () => {
    const secret = generateSecret();
    const url = new URL(buildInviteUrl('https://example.github.io/pis-stop/?x=1#old', secret));
    expect(url.pathname).toBe('/pis-stop/');
    expect(url.search).toBe('');
    expect(readInviteSecret(url.hash)).toEqual(secret);
  });

  it('accepts a hash with or without the leading #', () => {
    const secret = generateSecret();
    expect(readInviteSecret(`k=${toBase64Url(secret)}`)).toEqual(secret);
  });

  it.each([
    ['an empty hash', ''],
    ['another parameter', '#x=1'],
    ['a malformed secret', '#k=***'],
    ['a short secret', `#k=${toBase64Url(new Uint8Array(8))}`],
  ])('ignores %s', (_, hash) => {
    expect(readInviteSecret(hash)).toBeNull();
  });
});
