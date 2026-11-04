# Tasks: Declarative Public Feeds & Client Signal Bus

## 1. Declarative Feed Engine & Nickname Registry in report-runtime.js

- [x] 1.1 Implement `#feed-registry` JSON resolution and universal `fetch()` in `initPublicFeeds()` supporting `@nickname` references, URL fallback, and request deduplication across identical feeds
- [x] 1.2 Implement interval polling with `data-feed-interval`, minimum backoff guards, and clean timer teardown on unmount or `reinitReportContent()`

## 2. Universal Field Extraction & Chart.js Ring Buffer Hook

- [x] 2.1 Implement `data-feed-fields` key extraction in `report-runtime.js` supporting top-level and nested dot-notated paths (e.g. `data.val`)
- [x] 2.2 Implement `[data-feed-chart]` hook in `report-runtime.js` to auto-append live ticks to Chart.js dataset 0 with bounded ring buffer (`data-feed-buffer`) and `chart.update('none')`

## 3. Builder CLI Flags & Dev Server Proxy

- [x] 3.1 Update `skills/html-report/scripts/build-report.mjs` to auto-detect `data-public-feed` / `data-feed` signatures, include `datastar` CDN, and set `data-report-mode="live"`
- [x] 3.2 Add `--feed <name>=<url>`, `--freeze-feeds`, and `--feed-interval` CLI flags in `build-report.mjs` to inject the `#feed-registry` and snapshot live data into `data-feed-fallback` for offline archival and Playwright PDF export
- [x] 3.3 Add `--feed-proxy` option to `skills/html-report/scripts/serve-report.mjs` for routing non-CORS public endpoints

## 4. Verification & Testing

- [x] 4.1 Create unit test suite `tests/public-feed.test.mjs` covering nickname resolution, deduplication, universal URL fetching, field extraction, timer cleanup, CLI flag snapshotting, and signal assignment
- [x] 4.2 Verify full test suite passes with `node --test tests/*.test.mjs` with zero regressions
- [x] 4.3 Validate change compliance with `openspec validate declarative-public-feeds`
