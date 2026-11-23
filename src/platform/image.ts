import { fitWithin } from '../lib/image';
import type { EncodedImage } from '../lib/repository';

const TYPE = 'image/jpeg';

/**
 * Downscales and re-encodes a photo in the browser. Re-encoding also strips
 * EXIF metadata, so the original GPS tags never leave the phone.
 */
export const encodeImage = async (
  file: Blob,
  maxSide: number,
  quality: number,
): Promise<EncodedImage> => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = fitWithin(bitmap, maxSide);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (context === null) {
    bitmap.close();
    throw new Error('Canvas 2D is not available');
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: TYPE, quality });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: TYPE, width, height };
};
