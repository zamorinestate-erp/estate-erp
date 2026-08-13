'use strict';

// Zamorin Cafe ERP service worker.
//
// Security rule:
// Cache only the public frontend application shell and static same-origin
// assets. Never cache API responses, authenticated business data, POST
// requests, or cross-origin responses.

const APP_VERSION = '1.0.1';
const CACHE_NAME =
  `zamorin-public-shell-v${APP_VERSION}`;

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './src/styles/tokens.css',
  './src/styles/layout.css',
  './src/styles/components.css',
  './src/js/main.js',
  './src/js/version.js',
  './src/assets/zamorin-app-icon-vector.svg',
  './src/assets/zamorin-app-icon-1024.png',
  './src/assets/zamorin-estate-logo.png',
  './src/assets/zamorin-estate-mark.png',
];

const STATIC_DESTINATIONS = new Set([
  'script',
  'style',
  'image',
  'font',
  'manifest',
]);

function isApiPath(pathname) {
  return (
    pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/api/v1/')
  );
}

function isCacheableStaticRequest(request, url) {
  if (request.method !== 'GET') {
    return false;
  }

  if (url.origin !== self.location.origin) {
    return false;
  }

  if (isApiPath(url.pathname)) {
    return false;
  }

  if (
    request.headers.has('authorization') ||
    request.headers.has('x-api-key')
  ) {
    return false;
  }

  return STATIC_DESTINATIONS.has(
    request.destination
  );
}

async function cachePublicResponse(
  request,
  response
) {
  if (
    !response ||
    !response.ok ||
    response.type !== 'basic'
  ) {
    return;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

self.addEventListener(
  'install',
  (event) => {
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache) =>
          cache.addAll(SHELL_FILES)
        )
        .catch(() => {
          // A cache failure must not prevent the
          // application from installing.
        })
    );
  }
);

self.addEventListener(
  'activate',
  (event) => {
    event.waitUntil(
      Promise.all([
        caches
          .keys()
          .then((cacheNames) =>
            Promise.all(
              cacheNames
                .filter(
                  (name) =>
                    name.startsWith(
                      'zamorin-public-shell-'
                    ) &&
                    name !== CACHE_NAME
                )
                .map((name) =>
                  caches.delete(name)
                )
            )
          ),
        self.clients.claim(),
      ])
    );
  }
);

self.addEventListener(
  'fetch',
  (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') {
      return;
    }

    if (url.origin !== self.location.origin) {
      return;
    }

    if (isApiPath(url.pathname)) {
      return;
    }

    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request).catch(() =>
          caches.match('./index.html')
        )
      );

      return;
    }

    if (
      !isCacheableStaticRequest(
        request,
        url
      )
    ) {
      return;
    }

    event.respondWith(
      caches
        .match(request)
        .then((cachedResponse) => {
          const networkResponse = fetch(
            request
          )
            .then(async (response) => {
              await cachePublicResponse(
                request,
                response
              );

              return response;
            })
            .catch(() => cachedResponse);

          return (
            cachedResponse ||
            networkResponse
          );
        })
    );
  }
);

self.addEventListener(
  'message',
  (event) => {
    if (
      event.data === 'SKIP_WAITING'
    ) {
      self.skipWaiting();
    }

    if (
      event.data ===
      'CLEAR_PUBLIC_APP_CACHE'
    ) {
      event.waitUntil(
        caches.delete(CACHE_NAME)
      );
    }
  }
);