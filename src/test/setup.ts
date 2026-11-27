import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom's Blob has no `arrayBuffer()`, which every browser (and Node) has and
// the app uses to join byte chunks. Only patched where it is missing.
if (!('arrayBuffer' in Blob.prototype)) {
  /* eslint-disable functional/immutable-data, functional/no-this-expressions -- a jsdom gap */
  Object.defineProperty(Blob.prototype, 'arrayBuffer', {
    value(this: Blob): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          resolve(reader.result as ArrayBuffer);
        });
        reader.addEventListener('error', () => {
          reject(reader.error ?? new Error('Could not read the blob'));
        });
        reader.readAsArrayBuffer(this);
      });
    },
  });
  /* eslint-enable functional/immutable-data, functional/no-this-expressions */
}

afterEach(() => {
  cleanup();
});
