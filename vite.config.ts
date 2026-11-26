import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Content Security Policy, added to index.html at build time only (the dev
 * server needs inline scripts for hot reload). GitHub Pages cannot send HTTP
 * headers, so it is delivered as a <meta> tag. See SECURITY.md for each line.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  // The map is self-hosted (public/map/area.pmtiles): no third-party tiles.
  "img-src 'self' blob: data:",
  // Ably (live location, opt-in): its own host plus every *.ably-realtime.com
  // fallback/connectivity-check host it may use (see faqs.ably.com).
  "connect-src 'self' https://api.cloudinary.com https://res.cloudinary.com wss://main.realtime.ably.net https://main.realtime.ably.net wss://realtime.ably.io https://rest.ably.io wss://*.ably-realtime.com https://*.ably-realtime.com",
  "font-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "worker-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const contentSecurityPolicy = (): Plugin => ({
  name: 'pis-stop:csp',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
      injectTo: 'head-prepend',
    },
  ],
});

// `base: './'` keeps the build path-agnostic: it works at the root of a custom
// domain or under /pis-stop/ on GitHub Pages without extra configuration.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    // Public source maps: what runs in the browser can be read against the repo.
    sourcemap: true,
    // Everything as files: no inlined data: URLs to audit separately.
    assetsInlineLimit: 0,
  },
});
