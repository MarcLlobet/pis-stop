import { describe, expect, it } from 'vitest';

import { parseCloudinaryConfig } from './config';

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
