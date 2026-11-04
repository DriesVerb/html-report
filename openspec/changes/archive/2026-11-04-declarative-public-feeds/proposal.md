# Proposal: Live-Updating HTML Reports via Declarative Public Feeds

> Visual Plan & Companion Dashboard: [index.html](file:///home/eta/projects/html-report/openspec/changes/declarative-public-feeds/index.html) | Servable at `http://localhost:3000`

## Why

The primary goal is to empower `html-report` to generate **HTML reports that live-update in real time**. 

Currently, HTML reports are largely static snapshots. When developers or agents want a report that dynamically reacts to live telemetry (public APIs, cloud health, GitHub repos, CI/CD pipelines, weather stations, or market data), they must either run a complex backend or manually generate 60–120 lines of fragile JavaScript glue code. 

We need **live-updating reports to be a first-class, zero-friction citizen of the stack**: any report can become a living dashboard with ticking metrics, animated status badges, and sliding real-time charts using simple HTML attributes and ergonomic CLI flags.

## The Vision: What a "Live-Updating Report" Delivers

1. **Autonomous Client-Side Reactivity**: Open the report anywhere (local `file://`, `localhost:3000`, GitHub Pages, S3). It immediately establishes live feeds (standard REST polling or WebSocket/SSE) and starts ticking in real time without a dedicated backend server.
2. **Visual Live Feedback**:
   - Live metrics flash green/red upon updates using DaisyUI badges.
   - Status indicators pulse (`Connected · Syncing`).
   - Chart.js graphs append live data points smoothly across time with ring-buffer management (`chart.update('none')`).
3. **Universal Standard URLs (Zero Vendor Lock-in)**:
   - Ingests **any standard public URL** returning JSON (`https://...` or relative `/api/...`).
   - Dynamically unpacks JSON fields directly into Datastar reactive signals (e.g. `{ "temperature": 22 }` &rarr; `$temperature`).
   - No hardcoded third-party vendor APIs, no custom DSLs, and no brittle external coupling.
4. **Low Token Overhead**: Agents author live-updating cards in ~90 output tokens (saving ~85% token cost).
5. **Print & Archival Safe**: When exported to PDF via Playwright or printed, live tickers cleanly freeze their latest state instead of rendering empty loading states.

## What Changes

- **Client Runtime (`report-runtime.js`)**: Built-in declarative live engine (`initPublicFeeds()`) supporting universal `data-public-feed` URLs, optional `data-feed-prefix`, nested field selection, and `data-feed-chart`.
- **Builder CLI Flags (`build-report.mjs`)**:
  - `--freeze-feeds` / `--snapshot-feeds`: Pre-fetches feeds during build time for 100% offline self-containment and PDF generation.
  - `--feed-interval <ms>`: Overrides global polling intervals across all feeds in the report.
  - `--mock-feeds`: Simulates live feeds for sandbox presentations.
- **Dev Server (`serve-report.mjs`)**:
  - `--feed-proxy <prefix=target>`: Transparent reverse-proxy for public feeds that do not send CORS headers.

## Capabilities

### New Capabilities
- `declarative-public-feeds`: Defines the client-side declarative public data feed ingestion, signal binding, chart ring buffer updating, CLI snapshot flags, and offline/PDF fallback handling without server dependencies.

### Modified Capabilities
- *None*

## Impact

- Extends [`skills/html-report/assets/report-runtime.js`](file:///home/eta/projects/html-report/skills/html-report/assets/report-runtime.js) with `initPublicFeeds()`.
- Extends [`skills/html-report/scripts/build-report.mjs`](file:///home/eta/projects/html-report/skills/html-report/scripts/build-report.mjs) with detection and CLI flags.
- Extends [`skills/html-report/scripts/serve-report.mjs`](file:///home/eta/projects/html-report/skills/html-report/scripts/serve-report.mjs) with `--feed-proxy`.
- Zero new NPM dependencies; 100% backward compatible with existing static reports.
