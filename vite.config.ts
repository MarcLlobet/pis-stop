import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `base: './'` keeps the build path-agnostic: it works at the root of a custom
// domain or under /pis-stop/ on GitHub Pages without extra configuration.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
