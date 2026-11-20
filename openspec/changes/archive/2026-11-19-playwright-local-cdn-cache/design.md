# Design: On-Demand Disk Package Downloading & Local CDN Cache (`playwright-local-cdn-cache`)

> **Change:** `playwright-local-cdn-cache` | **Proposal:** [proposal.md](proposal.md) | **Tasks:** [tasks.md](tasks.md) | **Journey:** [index.html](index.html)

## Technical Decisions

### 1. Lazy On-Demand Package Downloading (`packages/core/scripts/lib/build/vendor-disk-cache.mjs`)
- **Storage Location**: `<workspaceRoot>/.cache/html-report-cdn/` (gitignored via `.cache/`) with fallback to `path.join(os.tmpdir(), "html-report-cdn-cache")`.
- **Used-Only Resolution (`extractUsedCdnUrls(html)`)**:
  - Scans the assembled report or `<main>` fragment via `detectAddons()` to determine the exact set of active libraries (`Core 4` + active addons).
  - Never downloads unused addons (e.g., `fullcalendar`, `katex`, `leaflet`, `reveal` stay un-downloaded until a report actually uses them).
- **Atomic Disk Persistence (`ensureUsedVendorsCached(urls, { cacheDir })`)**:
  - For each URL not yet present in `.cache/html-report-cdn/<sha256>.body` + `<sha256>.meta.json`, downloads the asset once, optionally validates its `integrity` (`sha384-...`) hash if declared, and writes via temp file + rename.

### 2. Playwright Disk Cache Interceptor (`packages/core/playwright/harness/cdn-cache.mjs`)
- `attachCdnDiskCache(context, { cacheDir, enabled = true })` registers a route handler matching:
  - `https://cdn.tailwindcss.com/**`
  - `https://cdn.jsdelivr.net/**`
  - `https://unpkg.com/**`
  - `https://cdnjs.cloudflare.com/**`
  - `https://server.arcgisonline.com/**`
- **Cache Hit (`<1ms`)**: Reads `<sha256>.body` and `<sha256>.meta.json` from disk and calls `route.fulfill({ status: 200, contentType, headers, body })`.
  - **Tailwind Play CDN CORS Rule**: For `cdn.tailwindcss.com`, omits `Access-Control-Allow-Origin` when the request has no `Origin` / `crossorigin` attribute, while including `Access-Control-Allow-Origin: *` for SRI-pinned `jsdelivr` / `unpkg` / `cdnjs` scripts and stylesheets.
- **Cache Miss (On-Demand Download)**: Calls `route.fetch()`, writes the response body and headers to `.cache/html-report-cdn/` on disk, and fulfills the route so all subsequent runs are instant and offline-capable.

### 3. CLI Controls in `verify-report.mjs`
- Enabled by default (`options.cdnCache !== false`).
- Supports `--no-cdn-cache` to bypass disk caching when testing live remote CDN endpoints, and `--cache-dir <dir>` to override the cache directory.
