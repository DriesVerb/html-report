# instant-pwa Specification

## Purpose
Enables instant, zero-friction Progressive Web App (PWA) generation for any HTML report created with `html-report`, including W3C Web App Manifest generation, Service Worker offline caching, multi-resolution app icons, theme-color synchronization, install prompt affordances, and existing-report conversion.

## ADDED Requirements

### Requirement: Instant PWA Asset Generation Engine
The system SHALL provide a zero-dependency PWA asset generator (`pwa-builder.mjs`) that programmatically outputs valid W3C Web App Manifests, Service Worker runtime scripts, and SVG/PNG application icons.

#### Scenario: Generating valid W3C Web App Manifest
- **GIVEN** report metadata including title, theme color, background color, and icons
- **WHEN** `buildManifest()` is invoked
- **THEN** it MUST return a valid JSON string conforming to the W3C Web App Manifest specification with `display: "standalone"`, `start_url`, `scope`, `name`, `short_name`, `theme_color`, `background_color`, and declared `icons`.

#### Scenario: Generating Service Worker with dual caching strategy
- **GIVEN** cache configuration and pre-cache asset lists
- **WHEN** `buildServiceWorker()` is invoked
- **THEN** it MUST return a valid Service Worker script implementing cache-first resolution for immutable CDN assets and network-first with cache-fallback for navigation documents.

#### Scenario: Generating multi-size scalable app icons
- **GIVEN** a report title or emoji glyph
- **WHEN** `buildAppIcons()` is invoked
- **THEN** it MUST generate scalable SVG icon assets and multi-size specifications (192x192, 512x512) with maskable safe-zone compatibility.

---

### Requirement: Command-Line PWA Assembly & Flag Support
The system SHALL provide first-class CLI integration in `build-report.mjs` and `harness.mjs` via the `--pwa` flag and `--mode pwa`, as well as a standalone converter tool `generate-pwa.mjs` for existing HTML reports.

#### Scenario: Building report with --pwa CLI flag
- **GIVEN** a semantic HTML content fragment
- **WHEN** `build-report.mjs` is executed with the `--pwa` flag
- **THEN** it MUST emit the report HTML with `<link rel="manifest">` and mobile meta tags, and generate companion `manifest.webmanifest`, `sw.js`, and icon files in the output directory.

#### Scenario: Transforming existing report with generate-pwa.mjs
- **GIVEN** an existing standalone HTML report file without prior PWA assets
- **WHEN** `generate-pwa.mjs <report.html>` is executed
- **THEN** it MUST inspect the report, inject PWA tags and Service Worker registration if absent, and generate companion manifest, service worker, and icon files.

#### Scenario: Harmonizing --mode pwa with dev server orchestration
- **GIVEN** a report built with `--mode pwa`
- **WHEN** inspected by `harness.mjs` or `serve-report.mjs`
- **THEN** the harness MUST assign `requiresServer: true`, stamp `data-report-mode="pwa"`, and display the PWA navbar badge.

---

### Requirement: In-Browser PWA Runtime & DaisyUI Integration
The browser client runtime SHALL integrate PWA lifecycle hooks, dynamic theme synchronization, native install prompt triggers, and network status alerts directly into the DaisyUI layout.

#### Scenario: Synchronizing DaisyUI active theme with meta theme-color
- **GIVEN** a report running in a browser with `<meta name="theme-color">`
- **WHEN** the user switches across any of the 32 DaisyUI themes or a custom theme
- **THEN** `report-runtime.js` MUST update the `content` attribute of `<meta name="theme-color">` to match the newly selected theme's primary or background color.

#### Scenario: Triggering native install prompt via beforeinstallprompt
- **GIVEN** a browser dispatching the `beforeinstallprompt` event
- **WHEN** the user views the report
- **THEN** the runtime MUST capture the event, reveal the `#pwa-install-btn` in the navbar and Download dropdown, and trigger `prompt()` when clicked.

#### Scenario: Reacting to online and offline network status changes
- **GIVEN** a browser switching between online and offline states
- **WHEN** `online` or `offline` events fire on the window
- **THEN** the runtime MUST toggle the `#pwa-offline-badge` indicating cached offline operation.

---

### Requirement: Offline Caching & Dev Server Serving
The local development server (`serve-report.mjs`) SHALL serve PWA assets with proper MIME types, caching directives, and service worker headers.

#### Scenario: Serving .webmanifest with standard MIME type
- **GIVEN** an HTTP request for a `.webmanifest` file
- **WHEN** `serve-report.mjs` handles the request
- **THEN** it MUST respond with `Content-Type: application/manifest+json`.

#### Scenario: Serving sw.js with Service-Worker-Allowed header
- **GIVEN** an HTTP request for `sw.js`
- **WHEN** `serve-report.mjs` handles the request
- **THEN** it MUST include the `Service-Worker-Allowed: /` header to permit root-scope service worker registration.
