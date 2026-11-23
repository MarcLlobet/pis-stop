import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Pure modules run in Node (real WebCrypto). Component tests opt into jsdom
    // with a `// @vitest-environment jsdom` docblock.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        // Vendored Untitled UI: covered upstream, kept byte-identical here.
        'src/components/**',
        'src/utils/**',
        // Thin adapters over browser-only APIs (canvas, geolocation, IndexedDB, Leaflet).
        'src/platform/**',
        'src/app/map-view.tsx',
      ],
      thresholds: {
        // The security-relevant code: crypto, signatures, parsing, storage.
        'src/lib/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
      },
    },
  },
});
