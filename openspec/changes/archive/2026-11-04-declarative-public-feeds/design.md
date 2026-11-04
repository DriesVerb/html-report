# Design: Declarative Public Feeds & Client Signal Bus

> Companion Plan & Visual Report: [index.html](file:///home/eta/projects/html-report/openspec/changes/declarative-public-feeds/index.html) | Servable at `http://localhost:3000`
> Specification Delta: [spec.md](file:///home/eta/projects/html-report/openspec/changes/declarative-public-feeds/specs/declarative-public-feeds/spec.md)
> Proposal Reference: [proposal.md](file:///home/eta/projects/html-report/openspec/changes/declarative-public-feeds/proposal.md)

## Context

See [proposal.md](file:///home/eta/projects/html-report/openspec/changes/declarative-public-feeds/proposal.md) for background and motivation. The `html-report` client architecture relies on pre-bundled CDN runtimes with [`report-runtime.js`](file:///home/eta/projects/html-report/skills/html-report/assets/report-runtime.js) providing lifecycle hydration (DaisyUI theme persistence, Lucide icon rehydration, Chart.js re-theming, Mermaid SVG rendering, and TOC indexing). [`build-report.mjs`](file:///home/eta/projects/html-report/skills/html-report/scripts/build-report.mjs) deterministically auto-detects dependencies and stitches user `<main>` fragments into [`template-shell.html`](file:///home/eta/projects/html-report/skills/html-report/assets/template-shell.html).

## Goals / Non-Goals

**Goals:**
- Provide a zero-backend, pure client-side declarative API (`data-public-feed`, `data-feed-chart`, `data-feed-fallback`) directly in [`report-runtime.js`](file:///home/eta/projects/html-report/skills/html-report/assets/report-runtime.js).
- Eliminate agent token waste and hallucination by introducing the **Nickname Registry** (`#feed-registry` JSON block and `@nickname` references).
- Support automatic request deduplication when multiple cards or charts observe the same feed.
- Support **any universal public HTTP URL or WebSocket endpoint** without vendor bias or proprietary DSL shortcuts.
- Provide developer CLI flags (`--feed <name>=<url>`, `--freeze-feeds`, `--feed-interval`, `--feed-proxy`) to streamline building, snapshotting, and serving live reports.
- Safely update Chart.js line/bar charts via ring buffers with `chart.update('none')` without destroying or re-initializing canvas contexts.
- Ensure Playwright headless PDF generation and offline views hydrate instantly using fallback snapshots.

**Non-Goals:**
- Hardcoding specific third-party commercial APIs into core JavaScript (instead, the report defines its own nicknames).
- Handling private API credentials client-side (those must use the backend proxy pattern via [`serve-report.mjs`](file:///home/eta/projects/html-report/skills/html-report/scripts/serve-report.mjs)).

## Decisions

### 1. The Nickname Registry Pattern (`#feed-registry`)
- **Decision**: Allow feeds to be defined centrally inside a JSON script block:
  ```html
  <script id="feed-registry" type="application/json">
  {
    "market": "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    "weather": "https://api.open-meteo.com/v1/forecast?latitude=52.5&longitude=13.4&current=temperature_2m",
    "github": "https://api.github.com/repos/tailwindlabs/tailwindcss"
  }
  </script>
  ```
- **Rationale**:
  - **AI Safety**: The AI outputs the complex URL only once. Across 10 cards and charts, it simply writes `data-public-feed="@market"` or `data-public-feed="@weather"`, preventing query-parameter typos and escaping bugs.
  - **Deduplication**: If 4 widgets use `@market`, `report-runtime.js` initiates only 1 fetch per interval and broadcasts the result to all matching signals.
  - **Zero Vendor Bias**: The runtime doesn't hardcode any vendor names. It simply maps `@nickname` &rarr; `registry[nickname]`.

### 2. Direct URL Fallback
- **Decision**: If a feed attribute does not start with `@`, treat it directly as a standard URL (`data-public-feed="https://..."`).

### 3. Signal Bridge to Datastar & Custom Event Dispatch
- **Decision**: When a feed resolves, dynamically set Datastar signals on the element (or closest signal scope) and dispatch a window-level `feed:tick` event containing `{ id, url, data, timestamp }`.

### 4. Chart.js Buffer Decoupling
- **Decision**: Canvases tagged with `data-feed-chart="<signal_key>"` register with a runtime chart controller. As feeds update the signal, a bounded ring buffer pushes the new point and drops points exceeding `data-feed-buffer="<max>"` (default 20).

### 5. Dedicated CLI Flags Architecture
- **Decision**:
  - `build-report.mjs --feed <name>=<url>`: Injects entries into `<script id="feed-registry">`.
  - `build-report.mjs --freeze-feeds`: During build, Node parses all feeds, executes initial HTTP requests, and bakes responses into `data-feed-fallback` attributes.
  - `serve-report.mjs --feed-proxy <path>=<targetUrl>`: Mounts transparent CORS proxy handlers.

## Risks / Trade-offs

- **[Risk] Missing Nickname Reference** &rarr; **Mitigation**: If an element references `@missing` and it's not found in `#feed-registry`, runtime logs a descriptive warning and sets `$feed_error = 'Unknown feed nickname: @missing'`.
- **[Risk] Multiple Timer Leaks on Hot Swapping** &rarr; **Mitigation**: All active timers and AbortControllers are tracked in a registry and aborted before re-initialization in `reinitReportContent()`.
