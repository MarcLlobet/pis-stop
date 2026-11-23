import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
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
        'src/vite-env.d.ts',
        // Thin adapters over browser-only APIs (canvas, geolocation, Leaflet).
        'src/platform/**',
        'src/components/MapView.tsx',
      ],
      thresholds: {
        'src/lib/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
      },
    },
  },
});
