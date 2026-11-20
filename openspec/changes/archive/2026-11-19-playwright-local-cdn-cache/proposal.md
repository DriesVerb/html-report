# Proposal: On-Demand Disk Package Downloading & Local CDN Cache (`playwright-local-cdn-cache`)

> **Change:** `playwright-local-cdn-cache` | **Journey Companion:** [index.html](index.html) | **Design:** [design.md](design.md) | **Tasks:** [tasks.md](tasks.md) | **Delta Spec:** [playwright-local-cdn-cache](specs/playwright-local-cdn-cache/spec.md)

## Why

Whenever `verify-report.mjs` verifies a report over `file://` or `http://localhost:3031`, headless Chromium downloads external CDN bundles (`cdn.tailwindcss.com`, `cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com`, `server.arcgisonline.com`) over the network on every single verification run. This adds 5–10 seconds of network latency per run and fails completely in offline or air-gapped environments.

At the same time, pre-downloading all 15 addons upfront would waste bandwidth on heavy libraries (`FullCalendar`, `KaTeX`, `Reveal.js`, `Leaflet`) when a simple report only uses `Core 4` + `Chart.js`.

## What Changes

1. **On-Demand Disk Vendor Downloader (`vendor-disk-cache.mjs`)**:
   - Downloads and persists CDN packages to `.cache/html-report-cdn/` on disk **only when they are actually used** by a report (`Core 4` + the specific addons detected by `detectAddons()`).
   - Stores each pinned asset atomically on disk keyed by URL SHA-256 alongside content-type metadata, verifying SRI hashes when present in `ADDON_REGISTRY`.
2. **Playwright Local Disk Route Interception (`cdn-cache.mjs`)**:
   - Attaches `context.route()` in `packages/core/playwright/harness/runner.mjs` for known CDN origins (`cdn.tailwindcss.com`, `cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com`, `server.arcgisonline.com`).
   - Serves cached packages directly from `.cache/html-report-cdn/` on disk in `<1ms` (preserving no-CORS headers for Tailwind Play CDN and CORS headers for SRI assets).
   - If a requested CDN asset is not yet on disk, downloads it once on demand, writes it to `.cache/html-report-cdn/`, and fulfills the request.
3. **Sub-Second DOM Readiness in `runner.mjs`**:
   - When all active CDN packages are served from local disk cache, `runner.mjs` navigates with `waitUntil: "domcontentloaded"` + `window.__REPORT_READY__` instead of stalling on remote `networkidle`, reducing verification time from ~6–10s to **~1s**.
