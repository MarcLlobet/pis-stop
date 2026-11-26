/// <reference lib="webworker" />
export {};

declare const self: ServiceWorkerGlobalScope;

/**
 * Exists only so the browser considers the app installable: no caching, no
 * offline support (that is a separate decision, not made here). Every
 * request still goes straight to the network, exactly as without this file.
 */
self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Deliberately empty: not calling respondWith() lets the browser handle
  // the request as usual.
});
