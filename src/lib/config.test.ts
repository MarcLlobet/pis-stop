import { describe, expect, it } from 'vitest';

import { parseAblyConfig, parseCloudinaryConfig } from './config';

describe('parseCloudinaryConfig', () => {
  it('reads and trims both values', () => {
    expect(
      parseCloudinaryConfig({
        VITE_CLOUDINARY_CLOUD_NAME: ' my-cloud ',
        VITE_CLOUDINARY_UPLOAD_PRESET: 'pis_stop',
      }),
    ).toEqual({ cloudName: 'my-cloud', uploadPreset: 'pis_stop' });
  });

  it.each([
    ['nothing', {}],
    ['only the cloud', { VITE_CLOUDINARY_CLOUD_NAME: 'cloud' }],
    ['empty values', { VITE_CLOUDINARY_CLOUD_NAME: '', VITE_CLOUDINARY_UPLOAD_PRESET: '' }],
    ['unsafe names', { VITE_CLOUDINARY_CLOUD_NAME: 'a/b', VITE_CLOUDINARY_UPLOAD_PRESET: 'p' }],
    ['non-strings', { VITE_CLOUDINARY_CLOUD_NAME: 1, VITE_CLOUDINARY_UPLOAD_PRESET: true }],
  ])('falls back to demo mode with %s', (_, env) => {
    expect(parseCloudinaryConfig(env)).toBeNull();
  });
});

describe('parseAblyConfig', () => {
  it('reads and trims a well-formed key', () => {
    const key = 'abcdEF.ghijKL:0123456789abcdef';
    expect(parseAblyConfig({ VITE_ABLY_KEY: ` ${key} ` })).toEqual({ key });
  });

  it('accepts the longer, 32-byte secret shape too', () => {
    const key = 'abcdEF.ghijKL:0123456789abcdef0123456789abcdef0123456789a';
    expect(parseAblyConfig({ VITE_ABLY_KEY: key })).toEqual({ key });
  });

  it.each([
    ['nothing', {}],
    ['empty', { VITE_ABLY_KEY: '' }],
    ['a non-string', { VITE_ABLY_KEY: 42 }],
    ['missing the secret', { VITE_ABLY_KEY: 'abcdEF.ghijKL' }],
    ['a secret of the wrong length', { VITE_ABLY_KEY: 'abcdEF.ghijKL:short' }],
    ['a Cloudinary-style value', { VITE_ABLY_KEY: 'my-cloud' }],
  ])('falls back to hiding the feature with %s', (_, env) => {
    expect(parseAblyConfig(env)).toBeNull();
  });
});
