/**
 * Stand-in for the canvas re-encoding of photos (jsdom has no canvas): the
 * picked file is used as the JPEG as it is, so a test can follow its exact
 * bytes through encryption, upload, download and decryption.
 */
import type { EncodedImage } from '../lib/repository';
import { readBlob } from './fake-cloudinary';

export const encodeImage = async (file: Blob): Promise<EncodedImage> => ({
  bytes: await readBlob(file),
  type: 'image/jpeg',
  width: 4,
  height: 3,
});
