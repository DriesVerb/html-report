# Spec Delta: Declarative Public Feeds & Client Signal Bus

## Purpose

Provides a zero-backend, client-side declarative engine and dedicated CLI flags that bind public REST and WebSocket feeds directly to reactive signals, live chart buffers, and PDF fallbacks with minimal token footprint.

## ADDED Requirements

### Requirement: Declarative Feed Discovery & Nickname Registry Ingestion
The client runtime MUST automatically discover elements containing `data-public-feed` upon page load or content re-initialization, resolve `@nickname` references against `<script id="feed-registry" type="application/json">`, deduplicate identical endpoint fetches, and bind parsed JSON fields into Datastar reactive signals.

#### Scenario: Nickname Resolution from Feed Registry
- **GIVEN** a document containing `<script id="feed-registry" type="application/json">{"market": "https://api.example.com/quotes"}</script>`
- **WHEN** an element declares `data-public-feed="@market"`
- **THEN** the runtime MUST resolve the target URL to `https://api.example.com/quotes` and perform the fetch request without requiring full URLs in HTML attributes.

#### Scenario: Request Deduplication Across Multiple Elements
- **GIVEN** multiple elements declaring `data-public-feed="@market"` or the same URL with identical intervals
- **WHEN** the polling interval triggers
- **THEN** the runtime MUST make only one network fetch request and distribute the returned payload to all bound signals and chart hooks.

#### Scenario: Interval Polling and Lifecycle Cleanup
- **GIVEN** an element with `data-public-feed` and `data-feed-interval="10000"`
- **WHEN** 10 seconds elapse
- **THEN** it MUST trigger another fetch and update signals without creating duplicate timers or memory leaks if the element is removed.

---

### Requirement: Field Extraction for Complex JSON Payloads
The client runtime MUST allow filtering and extracting specific top-level or nested keys from arbitrary JSON responses via `data-feed-fields` without requiring custom transformation code.

#### Scenario: Nested Key Path Extraction
- **GIVEN** an element with `data-public-feed="https://api.example.com/data"` and `data-feed-fields="user.count,status"`
- **WHEN** the payload arrives with `{"user": {"count": 42}, "status": "ok", "ignored": true}`
- **THEN** the runtime MUST bind `$user_count: 42` and `$status: "ok"` while ignoring unlisted keys.

---

### Requirement: Declarative Chart.js Ring Buffer Hook
The client runtime MUST allow Chart.js canvases to declare a live feed data binding via `data-feed-chart` to append live numeric data without re-rendering or tearing down the canvas context.

#### Scenario: Append Live Tick to Chart Dataset
- **GIVEN** a Chart.js canvas with `data-feed-chart="app_latency"` and `data-feed-buffer="20"`
- **WHEN** the feed updates with a new numeric value for `app_latency`
- **THEN** the runtime MUST push a timestamp label and data point to dataset 0, maintain a maximum buffer of 20 points, and invoke `chart.update('none')`.

---

### Requirement: Playwright PDF & Offline Snapshot Fallback
The client runtime MUST respect `data-feed-fallback` attributes to instantly populate signals and UI elements when offline or when rendered under Playwright PDF export mode.

#### Scenario: Offline or Headless Fallback Hydration
- **GIVEN** an element with `data-public-feed="https://api.example.com/stat"` and `data-feed-fallback='{"val": 1050}'`
- **WHEN** running in an offline environment or when `window.__PLAYWRIGHT_PDF_MODE__` is true
- **THEN** the runtime MUST immediately populate Datastar signals with the fallback payload without blocking on network requests.

---

### Requirement: Dedicated CLI Flags for Feed Freezing & Dev Server Proxy
The build CLI `build-report.mjs` and dev server `serve-report.mjs` MUST support dedicated flags to control feed polling intervals, inject the `#feed-registry`, freeze live snapshots into output HTML, and optionally proxy non-CORS public endpoints.

#### Scenario: Nickname Injection via CLI Flag
- **GIVEN** running `node skills/html-report/scripts/build-report.mjs --feed market=https://api.example.com/quotes`
- **WHEN** assembling the HTML report
- **THEN** the builder MUST inject or update `<script id="feed-registry" type="application/json">` with `"market": "https://api.example.com/quotes"`.

#### Scenario: Build-Time Snapshot Freezing
- **GIVEN** an HTML fragment containing `data-public-feed="@market"`
- **WHEN** running `node skills/html-report/scripts/build-report.mjs --freeze-feeds`
- **THEN** the builder MUST fetch the current endpoint values and inject them into `data-feed-fallback` attributes in the generated report.

#### Scenario: Dev Server Feed Proxy
- **GIVEN** running `node skills/html-report/scripts/serve-report.mjs --feed-proxy /feed/api=https://api.external.com`
- **WHEN** a client browser requests `http://localhost:3000/feed/api/data`
- **THEN** the dev server MUST forward the request to `https://api.external.com/data` and add CORS response headers.
