#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

/**
 * skills/html-report/scripts/pwa-builder.mjs
 *
 * Core Progressive Web App (PWA) Engine for html-report.
 * Zero external runtime dependencies - pure Node.js standard library built-ins.
 *
 * Provides:
 * 1. W3C Web App Manifest generator (manifest.webmanifest)
 * 2. High-performance Service Worker generator with dual caching strategy (sw.js)
 * 3. Scalable vector & raster application icon generator (SVG)
 * 4. HTML tag injector for PWA meta tags, manifest links, and SW registration
 * 5. Asset generation and file emission utilities
 */

export const DEFAULT_PWA_CONFIG = Object.freeze({
  themeColor: "#2563eb",
  backgroundColor: "#ffffff",
  display: "standalone",
  orientation: "any",
  categories: ["business", "productivity", "utilities"],
  cacheVersion: "1.0.0",
  swFileName: "sw.js",
  manifestFileName: "manifest.webmanifest",
  iconFileName: "icon.svg",
  iconPng192: "icon-192.png",
  iconPng512: "icon-512.png"
});

export const CORE_CDN_PRECACHE_URLS = Object.freeze([
  "https://cdn.tailwindcss.com",
  "https://cdn.jsdelivr.net/npm/daisyui@4.12.14/dist/full.min.css",
  "https://cdn.jsdelivr.net/npm/lucide@0.460.0/dist/umd/lucide.min.js",
  "https://cdn.jsdelivr.net/npm/showdown@2.1.0/dist/showdown.min.js",
  "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css",
  "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js"
]);

/**
 * Derives a clean short name from a report title (max 16 chars).
 */
export function deriveShortName(title = "HTML Report") {
  if (!title || typeof title !== "string") return "Report";
  const cleaned = title.replace(/[^\w\s-]/g, "").trim();
  if (cleaned.length <= 16) return cleaned || "Report";
  const words = cleaned.split(/\s+/);
  if (words[0].length <= 16) return words[0];
  return cleaned.slice(0, 16).trim();
}

/**
 * Generates an SVG application icon.
 * Features a modern rounded container, subtle linear gradient, and crisp centered glyph/emoji.
 */
export function buildAppIconSvg({
  emoji = "📊",
  title = "Report",
  primaryColor = "#2563eb",
  backgroundColor = "#ffffff"
} = {}) {
  const cleanEmoji = emoji || "📊";
  const monogram = (title || "R").trim().slice(0, 2).toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="pwa-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryColor}" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <filter id="pwa-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.25" />
    </filter>
  </defs>

  <!-- Maskable Safe Background -->
  <rect width="512" height="512" fill="${backgroundColor}" />

  <!-- App Icon Badge -->
  <rect x="48" y="48" width="416" height="416" rx="96" ry="96" fill="url(#pwa-grad)" filter="url(#pwa-shadow)" />

  <!-- Inner Soft Border -->
  <rect x="52" y="52" width="408" height="408" rx="92" ry="92" fill="none" stroke="#ffffff" stroke-width="4" stroke-opacity="0.3" />

  <!-- Centered Emoji or Monogram -->
  <text x="256" y="310" font-size="200" text-anchor="middle" dominant-baseline="central" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
    ${cleanEmoji}
  </text>
</svg>`;
}

/**
 * Builds a W3C Web App Manifest object.
 */
export function buildManifest({
  title = "HTML Report",
  shortName = null,
  description = "Publication-grade interactive HTML report Progressive Web App",
  themeColor = DEFAULT_PWA_CONFIG.themeColor,
  backgroundColor = DEFAULT_PWA_CONFIG.backgroundColor,
  startUrl = "./",
  scope = "./",
  display = DEFAULT_PWA_CONFIG.display,
  orientation = DEFAULT_PWA_CONFIG.orientation,
  categories = DEFAULT_PWA_CONFIG.categories,
  iconFileName = DEFAULT_PWA_CONFIG.iconFileName,
  icons = null,
  shortcuts = null
} = {}) {
  const resolvedShortName = shortName || deriveShortName(title);

  const defaultIcons = [
    {
      src: iconFileName,
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any maskable"
    },
    {
      src: iconFileName,
      sizes: "192x192",
      type: "image/svg+xml",
      purpose: "any"
    },
    {
      src: iconFileName,
      sizes: "512x512",
      type: "image/svg+xml",
      purpose: "any"
    }
  ];

  const defaultShortcuts = [
    {
      name: "Table of Contents",
      short_name: "Contents",
      description: "Jump straight to the report sections and navigation table of contents",
      url: `${startUrl}#navbar-report-title`,
      icons: [{ src: iconFileName, sizes: "any" }]
    }
  ];

  return {
    name: title,
    short_name: resolvedShortName,
    description,
    start_url: startUrl,
    scope,
    display,
    orientation,
    theme_color: themeColor,
    background_color: backgroundColor,
    categories,
    icons: icons || defaultIcons,
    shortcuts: shortcuts || defaultShortcuts
  };
}

/**
 * Builds the Service Worker script (sw.js) implementing the dual-strategy caching engine.
 */
export function buildServiceWorker({
  cacheName = "html-report-pwa-v1",
  preCacheUrls = ["./"],
  version = "1.0.0"
} = {}) {
  return `/**
 * html-report PWA Service Worker (sw.js)
 * Cache Name: ${cacheName}
 * Version: ${version}
 *
 * Implements:
 * 1. Cache-First with Network-Fallback for immutable CDN libraries and static assets
 * 2. Network-First with Cache-Fallback for document navigation HTML
 * 3. Immediate activation via skipWaiting() and clients.claim()
 * 4. Stale cache cleanup on activate
 * 5. Bypass for live real-time SSE streams (__live_reload__, __datastar_stream__)
 */

const CACHE_NAME = "${cacheName}";
const PRECACHE_ASSETS = ${JSON.stringify(preCacheUrls, null, 2)};

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
  const isStaticAsset = url.pathname.match(/\\.(?:css|js|mjs|svg|png|jpg|jpeg|woff2?|ttf|ico|webmanifest)$/i);

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
`;
}

/**
 * Builds the HTML <head> tags snippet for PWA support.
 */
export function buildPwaHeadTags({
  manifestHref = "manifest.webmanifest",
  themeColor = DEFAULT_PWA_CONFIG.themeColor,
  iconHref = "icon.svg",
  title = "HTML Report"
} = {}) {
  const shortTitle = deriveShortName(title);
  return `  <!-- Progressive Web App (PWA) Manifest & Mobile Meta -->
  <link rel="manifest" href="${manifestHref}" />
  <meta name="theme-color" id="pwa-theme-color" content="${themeColor}" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="${shortTitle}" />
  <link rel="apple-touch-icon" href="${iconHref}" />`;
}

/**
 * Injects PWA head tags, navbar install button, and service worker registration into an HTML string.
 */
export function injectPwaIntoHtml(html, {
  manifestHref = "manifest.webmanifest",
  themeColor = DEFAULT_PWA_CONFIG.themeColor,
  iconHref = "icon.svg",
  title = "HTML Report",
  swHref = "./sw.js"
} = {}) {
  let updated = html;

  // 1. Inject <head> tags if manifest link not already present
  if (!updated.includes('rel="manifest"') && !updated.includes("rel='manifest'")) {
    const headTags = buildPwaHeadTags({ manifestHref, themeColor, iconHref, title });
    if (updated.includes("</head>")) {
      updated = updated.replace("</head>", `${headTags}\n</head>`);
    } else {
      updated = headTags + "\n" + updated;
    }
  }

  // 2. Inject PWA Install button into the navbar download dropdown if present
  const downloadMenuMatch = updated.match(/<ul\s+id=["']download-dropdown-menu["'][^>]*>([\s\S]*?)<\/ul>/i);
  if (downloadMenuMatch && !updated.includes("pwa-install-menu-item")) {
    const pwaMenuItem = `            <li id="pwa-install-menu-item">
              <button id="pwa-install-dropdown-btn" type="button" onclick="if(window.triggerPwaInstall) window.triggerPwaInstall()" class="flex items-center justify-between py-2 text-xs font-semibold">
                <div class="flex items-center gap-2.5">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>Install as App (PWA)</span>
                </div>
                <span id="pwa-install-status-badge" class="badge badge-accent badge-xs font-mono">Installable</span>
              </button>
            </li>\n`;
    updated = updated.replace(downloadMenuMatch[0], downloadMenuMatch[0].replace("<ul", "<ul").replace(/<\/ul>/i, `${pwaMenuItem}          </ul>`));
  }

  // 3. Inject PWA Install button into navbar-end if not already present
  if (!updated.includes("id=\"pwa-install-btn\"") && !updated.includes("id='pwa-install-btn'")) {
    const navbarEndMatch = updated.match(/<div\s+class=["'][^"']*navbar-end[^"']*["'][^>]*>/i);
    if (navbarEndMatch) {
      const pwaNavBtn = `\n        <!-- PWA Install Button -->\n        <button id="pwa-install-btn" type="button" onclick="if(window.triggerPwaInstall) window.triggerPwaInstall()" class="btn btn-xs sm:btn-sm btn-outline btn-accent hidden gap-1.5 shrink-0" aria-label="Install Report as App" title="Install as Desktop/Mobile App">\n          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">\n            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v6m0 0l-3-3m3 3l3-3M12 4v4" />\n          </svg>\n          <span class="hidden md:inline">Install App</span>\n        </button>\n        <span id="pwa-offline-badge" class="badge badge-warning badge-sm hidden gap-1 font-mono text-3xs shrink-0" title="Report is operating offline from local Service Worker cache">\n          <span class="inline-block w-1.5 h-1.5 rounded-full bg-warning-content animate-pulse"></span>\n          <span>Offline</span>\n        </span>\n`;
      updated = updated.replace(navbarEndMatch[0], navbarEndMatch[0] + pwaNavBtn);
    }
  }

  // 4. Inject standalone Service Worker registration snippet if not present
  if (!updated.includes("__PWA_SW_REGISTERED__")) {
    const swRegistrationSnippet = `
  <!-- PWA Service Worker Registration & Theme Color Sync -->
  <script id="__pwa_sw_registration__">
    window.__PWA_SW_REGISTERED__ = true;
    (function () {
      let deferredInstallPrompt = null;

      // 1. Service Worker Registration
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
          navigator.serviceWorker.register("${swHref}")
            .then((reg) => {
              window.__PWA_REGISTRATION__ = reg;
              reg.addEventListener("updatefound", () => {
                const newWorker = reg.installing;
                if (newWorker) {
                  newWorker.addEventListener("statechange", () => {
                    if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                      console.log("[html-report PWA] New version available. Refresh to update.");
                    }
                  });
                }
              });
            })
            .catch((err) => {
              console.warn("[html-report PWA] Service Worker registration skipped:", err.message);
            });
        });
      }

      // 2. Native PWA Install Prompt Interception
      window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        const installBtn = document.getElementById("pwa-install-btn");
        if (installBtn) installBtn.classList.remove("hidden");
        const statusBadge = document.getElementById("pwa-install-status-badge");
        if (statusBadge) statusBadge.classList.remove("hidden");
      });

      window.triggerPwaInstall = async function () {
        if (!deferredInstallPrompt) {
          alert("To install this report as an app, use your browser menu ('Install' or 'Add to Home Screen').");
          return;
        }
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === "accepted") {
          const installBtn = document.getElementById("pwa-install-btn");
          if (installBtn) installBtn.classList.add("hidden");
        }
        deferredInstallPrompt = null;
      };

      window.addEventListener("appinstalled", () => {
        const installBtn = document.getElementById("pwa-install-btn");
        if (installBtn) installBtn.classList.add("hidden");
        const statusBadge = document.getElementById("pwa-install-status-badge");
        if (statusBadge) {
          statusBadge.textContent = "Installed";
          statusBadge.className = "badge badge-success badge-xs font-mono";
        }
        deferredInstallPrompt = null;
      });

      // 3. Online / Offline Status Detection
      function updateNetworkStatus() {
        const offlineBadge = document.getElementById("pwa-offline-badge");
        if (!offlineBadge) return;
        if (navigator.onLine === false) {
          offlineBadge.classList.remove("hidden");
        } else {
          offlineBadge.classList.add("hidden");
        }
      }
      window.addEventListener("online", updateNetworkStatus);
      window.addEventListener("offline", updateNetworkStatus);
      window.addEventListener("DOMContentLoaded", updateNetworkStatus);

      // 4. DaisyUI Theme-Color Sync
      function syncPwaThemeColor() {
        const meta = document.getElementById("pwa-theme-color") || document.querySelector('meta[name="theme-color"]');
        if (!meta) return;
        try {
          const primaryEl = document.querySelector(".bg-primary") || document.body;
          const bg = window.getComputedStyle(primaryEl).backgroundColor;
          if (bg && bg !== "transparent") {
            meta.setAttribute("content", bg);
          }
        } catch (_) {}
      }
      window.syncPwaThemeColor = syncPwaThemeColor;
      window.addEventListener("DOMContentLoaded", () => setTimeout(syncPwaThemeColor, 200));
    })();
  </script>
`;
    if (updated.includes("</body>")) {
      updated = updated.replace("</body>", `${swRegistrationSnippet}\n</body>`);
    } else {
      updated = updated + swRegistrationSnippet;
    }
  }

  return updated;
}

/**
 * Generates all companion PWA assets on disk and returns paths & content strings.
 */
export function generatePwaAssets({
  outputDir = process.cwd(),
  reportFileName = "report.html",
  title = "HTML Report",
  shortName = null,
  description = null,
  themeColor = DEFAULT_PWA_CONFIG.themeColor,
  backgroundColor = DEFAULT_PWA_CONFIG.backgroundColor,
  emoji = "📊",
  cacheVersion = "1.0.0",
  preCacheUrls = null,
  includeCoreCdn = false,
  categories = DEFAULT_PWA_CONFIG.categories,
  manifestFileName = DEFAULT_PWA_CONFIG.manifestFileName,
  swFileName = DEFAULT_PWA_CONFIG.swFileName,
  iconFileName = DEFAULT_PWA_CONFIG.iconFileName,
  writeFiles = true
} = {}) {
  const resolvedShortName = shortName || deriveShortName(title);
  const cacheName = `html-report-pwa-${cacheVersion.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  // 1. Build Icon SVG
  const iconSvg = buildAppIconSvg({
    emoji,
    title,
    primaryColor: themeColor,
    backgroundColor
  });

  // 2. Build Manifest
  const manifestObj = buildManifest({
    title,
    shortName: resolvedShortName,
    description: description || `Publication-grade PWA for ${title}`,
    themeColor,
    backgroundColor,
    startUrl: `./${reportFileName}`,
    scope: "./",
    iconFileName,
    categories,
    display: "standalone"
  });
  const manifestJson = JSON.stringify(manifestObj, null, 2);

  // 3. Build Service Worker
  const defaultPreCache = [
    `./${reportFileName}`,
    `./${manifestFileName}`,
    `./${iconFileName}`
  ];
  const finalPreCache = preCacheUrls || (includeCoreCdn ? [...defaultPreCache, ...CORE_CDN_PRECACHE_URLS] : defaultPreCache);
  const swCode = buildServiceWorker({
    cacheName,
    preCacheUrls: finalPreCache,
    version: cacheVersion
  });

  // Paths
  const manifestPath = path.resolve(outputDir, manifestFileName);
  const swPath = path.resolve(outputDir, swFileName);
  const iconPath = path.resolve(outputDir, iconFileName);

  if (writeFiles) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(manifestPath, manifestJson, "utf-8");
    fs.writeFileSync(swPath, swCode, "utf-8");
    fs.writeFileSync(iconPath, iconSvg, "utf-8");
  }

  const headTags = buildPwaHeadTags({
    manifestHref: manifestFileName,
    themeColor,
    iconHref: iconFileName,
    title
  });

  return {
    outputDir,
    manifestPath,
    swPath,
    iconPath,
    manifestJson,
    manifestObj,
    swCode,
    iconSvg,
    headTags,
    cacheName
  };
}

export const buildPwa = generatePwaAssets;
export const buildPwaAssets = generatePwaAssets;

/**
 * Convenience generator for packaging the HTML Report Creation Studio (create.html)
 * as an offline-first Progressive Web App.
 */
export function generateStudioPwaAssets({
  outputDir = process.cwd(),
  themeColor = "#2563eb",
  writeFiles = true
} = {}) {
  const defaultStudioPreCache = [
    "./create.html",
    "./manifest.webmanifest",
    "./icon.svg",
    ...CORE_CDN_PRECACHE_URLS
  ];
  return generatePwaAssets({
    outputDir,
    reportFileName: "create.html",
    title: "HTML Report Creation Studio",
    shortName: "HTML Studio",
    description: "Interactive onboarding decision wizard, OKLCH theme studio, and deterministic prompt generator",
    themeColor,
    backgroundColor: "#ffffff",
    emoji: "✨",
    categories: ["productivity", "developer", "utilities"],
    preCacheUrls: defaultStudioPreCache,
    writeFiles
  });
}
