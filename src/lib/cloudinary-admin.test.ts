import { describe, expect, it } from 'vitest';

import {
  createPresetRequest,
  deleteFilesRequest,
  deletePresetRequest,
  parseAdminCredentials,
  presetName,
  publicIdFromUrl,
} from './cloudinary-admin';

const credentials = {
  cloudName: 'my-cloud',
  apiKey: '123456789012345',
  apiSecret: 'abcDEF_123-xyz',
};

describe('parseAdminCredentials', () => {
  it('reads and trims the cloud name, key and secret', () => {
    expect(
      parseAdminCredentials({
        VITE_CLOUDINARY_CLOUD_NAME: 'my-cloud',
        CLOUDINARY_API_KEY: ' 123456789012345 ',
        CLOUDINARY_API_SECRET: 'abcDEF_123-xyz\n',
      }),
    ).toEqual(credentials);
  });

  it.each([
    ['nothing', {}],
    ['no secret', { VITE_CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: '123456' }],
    [
      'a malformed key',
      {
        VITE_CLOUDINARY_CLOUD_NAME: 'c',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'abcDEF_123-xyz',
      },
    ],
    [
      'an unsafe cloud name',
      {
        VITE_CLOUDINARY_CLOUD_NAME: 'a/b',
        CLOUDINARY_API_KEY: '123456',
        CLOUDINARY_API_SECRET: 'abcDEF_123-xyz',
      },
    ],
  ])('returns null with %s', (_, env) => {
    expect(parseAdminCredentials(env)).toBeNull();
  });
});

describe('upload presets', () => {
  it('names a preset with 128 random bits', () => {
    expect(presetName(new Uint8Array(16).fill(0xab))).toBe(`ps_${'ab'.repeat(16)}`);
  });

  it('creates an unsigned preset that never lets uploaders choose file names', () => {
    const { url, init } = createPresetRequest(credentials, 'ps_x');
    expect(url).toBe('https://api.cloudinary.com/v1_1/my-cloud/upload_presets');
    expect(init.method).toBe('POST');
    expect(typeof init.body).toBe('string');
    expect(JSON.parse(typeof init.body === 'string' ? init.body : '')).toEqual({
      name: 'ps_x',
      unsigned: true,
      disallow_public_id: true,
      use_filename: false,
      unique_filename: true,
      overwrite: false,
    });
    expect(new Headers(init.headers).get('Authorization')).toBe(
      `Basic ${btoa('123456789012345:abcDEF_123-xyz')}`,
    );
  });

  it('deletes a preset by name', () => {
    const { url, init } = deletePresetRequest(credentials, 'ps_x');
    expect(url).toBe('https://api.cloudinary.com/v1_1/my-cloud/upload_presets/ps_x');
    expect(init.method).toBe('DELETE');
  });
});

describe('publicIdFromUrl', () => {
  const base = 'https://res.cloudinary.com/my-cloud/raw/upload/v1700000000';

  it('reads the public id of a file in this account', () => {
    expect(publicIdFromUrl('my-cloud', `${base}/abc123_X-y`)).toBe('abc123_X-y');
    expect(publicIdFromUrl('my-cloud', `${base}/folder/abc`)).toBe('folder/abc');
  });

  it.each([
    ['another account', 'https://res.cloudinary.com/other/raw/upload/v1/abc'],
    ['an image upload', 'https://res.cloudinary.com/my-cloud/image/upload/v1/abc'],
    ['another host', 'https://example.com/my-cloud/raw/upload/v1/abc'],
    ['a path trick', `${base}/../abc`],
    ['a query string', `${base}/abc?x=1`],
  ])('refuses %s', (_, url) => {
    expect(publicIdFromUrl('my-cloud', url)).toBeNull();
  });
});

describe('deleteFilesRequest', () => {
  it('deletes raw files by public id and clears them from the CDN', () => {
    const { url, init } = deleteFilesRequest(credentials, ['a', 'b/c']);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/v1_1/my-cloud/resources/raw/upload');
    expect(parsed.searchParams.getAll('public_ids[]')).toEqual(['a', 'b/c']);
    expect(parsed.searchParams.get('invalidate')).toBe('true');
    expect(init.method).toBe('DELETE');
    expect(new Headers(init.headers).get('Authorization')).toBe(
      `Basic ${btoa('123456789012345:abcDEF_123-xyz')}`,
    );
  });
});
