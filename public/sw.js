/*
 * BB Diagnostics service worker (hand-written: no bundler step, works the same with Turbopack in
 * dev and with `next build`). Rules shared with the app live in /sw-rules.js.
 *
 * - App shell: built JS/CSS and fonts cache-first; page navigations network-first with the last
 *   copy (then /offline) when the network is gone. Pages carry no patient data (they fetch it).
 * - API GETs on the whitelist: network-first, last answer kept per user in `bb-api-<userId>`
 *   (user taken from the Bearer token), never for patients, never for auth/files/PDF/DICOM.
 * - Writes are never handled here: the app's outbox queues them (it holds the session token).
 */
importScripts('/sw-rules.js');

const SHELL_CACHE = 'bb-shell-v1';
const STATIC_CACHE = 'bb-static-v1';
const PAGES_CACHE = 'bb-pages-v1';
const API_PREFIX = 'bb-api-';
const KEEP = [SHELL_CACHE, STATIC_CACHE, PAGES_CACHE];
const SHELL = ['/offline', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/favicon.png'];

const rules = self.BB_OFFLINE_RULES;
const neverCache = rules.neverCache.map((p) => new RegExp(p, 'i'));
const cacheableGets = rules.cacheableGets.map((p) => new RegExp(p));

function apiCacheable(path) {
  if (neverCache.some((re) => re.test(path))) return false;
  return cacheableGets.some((re) => re.test(path));
}

function claimsOf(request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    const userId = claims.userId || claims.sub;
    return userId ? { userId, role: claims.role || '' } : null;
  } catch {
    return null;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !KEEP.includes(n) && !n.startsWith(API_PREFIX)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function pageNetworkFirst(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) || (await caches.match('/offline')) || Response.error();
  }
}

async function apiNetworkFirst(request, userId) {
  const cache = await caches.open(API_PREFIX + userId);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request.url, response.clone());
    return response;
  } catch (e) {
    const hit = await cache.match(request.url);
    if (!hit) throw e;
    // Tell the page this answer is a saved copy
    const headers = new Headers(hit.headers);
    headers.set('X-BB-Offline-Copy', '1');
    return new Response(await hit.blob(), { status: hit.status, statusText: hit.statusText, headers });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    if (!apiCacheable(url.pathname)) return;
    const claims = claimsOf(request);
    // Logged out or patient portal: straight to the network, nothing kept
    if (!claims || !claims.role || claims.role === 'PATIENT') return;
    event.respondWith(apiNetworkFirst(request, claims.userId));
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/favicon.png') {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
      return;
    }
    if (request.mode === 'navigate') {
      event.respondWith(pageNetworkFirst(request));
    }
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'wipe') {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((n) => n.startsWith(API_PREFIX)).map((n) => caches.delete(n)))));
  }
});

// Background Sync: the outbox lives in the page (it needs the session token), so wake it up
self.addEventListener('sync', (event) => {
  if (event.tag !== 'bb-outbox') return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => clients.forEach((client) => client.postMessage({ type: 'replay' })))
  );
});
