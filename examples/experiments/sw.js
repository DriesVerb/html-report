/**
 * html-report PWA Service Worker (sw.js)
 * Cache Name: html-report-pwa-1-0-0
 * Version: 1.0.0
 *
 * Implements:
 * 1. Cache-First with Network-Fallback for immutable CDN libraries and static assets
 * 2. Network-First with Cache-Fallback for document navigation HTML
 * 3. Immediate activation via skipWaiting() and clients.claim()
 * 4. Stale cache cleanup on activate
 * 5. Bypass for live real-time SSE streams (__live_reload__, __datastar_stream__)
 */

const CACHE_NAME = "html-report-pwa-1-0-0";
const PRECACHE_ASSETS = [
  "./pokemon-live-report.html",
  "./manifest.webmanifest",
  "./icon.svg"
];

// CDN domain patterns eligible for Cache-First caching
const IMMUTABLE_CDN_HOSTS = [
  "cdn.tailwindcss.com",
  "cdn.jsdelivr.net",
  "cdnjs.cloudflare.com",
  "unpkg.com",
  "server.arcgisonline.com"
];

// URLs that should never be intercepted or cached
const BYPASS_PATTERNS = [
  "/__live_reload__",
  "/__datastar_stream__",
  "/__report_mode__"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        // Non-fatal if some optional assets are missing during local dev
        console.warn("[PWA-SW] Pre-cache warning:", err.message);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith("html-report-pwa-")) {
            console.log("[PWA-SW] Deleting stale cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 1. Bypass dynamic SSE / Live streams entirely
  for (const pattern of BYPASS_PATTERNS) {
    if (url.pathname.includes(pattern)) return;
  }

  // 2. Navigation Request (HTML Document): Network-First with Cache-Fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match(req).then((cached) => {
            if (cached) return cached;
            // Fallback to precached root navigation
            return caches.match("./").then((rootCached) => {
              if (rootCached) return rootCached;
              return caches.match("./index.html");
            });
          });
        })
    );
    return;
  }

  // 3. Static CDN Libraries: Cache-First
  const isCdn = IMMUTABLE_CDN_HOSTS.some((host) => url.hostname.includes(host));
  const isStaticAsset = url.pathname.match(/\.(?:css|js|mjs|svg|png|jpg|jpeg|woff2?|ttf|ico|webmanifest)$/i);

  if (isCdn || isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((networkRes) => {
          if (networkRes && (networkRes.status === 200 || networkRes.type === "opaque")) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        }).catch((err) => {
          console.warn("[PWA-SW] Fetch failed for:", req.url, err.message);
        });
      })
    );
    return;
  }

  // Default: Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      }).catch(() => null);

      return cached || fetchPromise;
    })
  );
});

// Client communication channel
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
