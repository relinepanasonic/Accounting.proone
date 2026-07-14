// Chrome PWA Service Worker for Professor Toko Online Suite
const CACHE_NAME = 'pto-finance-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Passively pass network requests through while satisfying Chrome's PWA fetch listener requirement
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Offline mode: Please check your internet connection.', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'Content-Type': 'text/plain' }),
      });
    })
  );
});
