# Delta Specification: playwright-local-cdn-cache

## ADDED Requirements

### Requirement: On-Demand Disk Downloading of Used CDN Packages
The system SHALL lazily download and persist external CDN assets (`Core 4` + active addons detected in the report) to a local disk cache (`.cache/html-report-cdn/`) only when those packages are actually used by a report.

#### Scenario: Unused heavy addons are not downloaded to disk
- **WHEN** a report uses only `Core 4` and `Chart.js`
- **THEN** only `Core 4` and `Chart.js` CDN assets are downloaded and cached in `.cache/html-report-cdn/`, while unused addons (`FullCalendar`, `KaTeX`, `Leaflet`, `Reveal.js`) are not downloaded.

### Requirement: Sub-Millisecond Disk Cache Fulfillment in Playwright Verification
`verify-report.mjs` SHALL intercept CDN requests during Playwright verification and serve previously used packages directly from `.cache/html-report-cdn/` on disk, falling back to an on-demand download-and-persist on first use (unless `--no-cdn-cache` is passed).

#### Scenario: Second verification run completes with zero remote CDN downloads
- **WHEN** `verify-report.mjs` runs against a report whose active CDN packages have already been cached in `.cache/html-report-cdn/`
- **THEN** Playwright fulfills all CDN script/stylesheet requests from local disk in `<1ms` without making external network requests.
