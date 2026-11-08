# Spec Delta: html-wizard-pwa-install

## Purpose

Provides automated Progressive Web App (PWA) packaging, offline service worker caching, and desktop/mobile installation capabilities for the HTML Report Creation Studio ([create.html](file:///home/eta/projects/html-report/create.html)) and arbitrary HTML reports.

## ADDED Requirements

### Requirement: Slash command and CLI installer
The system SHALL provide an automated installer command `/html-install` and CLI script `skills/html-create/scripts/install-pwa.mjs` that packages [create.html](file:///home/eta/projects/html-report/create.html) as an installable PWA and serves it for instant installation.

#### Scenario: Running `/html-install` or CLI installer
- **WHEN** user executes `/html-install` or runs `node skills/html-create/scripts/install-pwa.mjs`
- **THEN** the system generates `manifest.webmanifest`, `sw.js`, and `icon.svg` tailored for the creation studio, verifies HTML tags in `create.html`, starts/re-uses the local server, and opens the browser to initiate app installation.

### Requirement: W3C Web App Manifest for Creation Studio
The system SHALL generate a compliant W3C Web App Manifest for the creation studio specifying standalone display mode, developer categories, vector icon assets, and deep-link shortcut actions.

#### Scenario: Manifest validation and metadata
- **WHEN** the browser requests `manifest.webmanifest`
- **THEN** it receives JSON with `name: "HTML Report Creation Studio"`, `short_name: "HTML Studio"`, `display: "standalone"`, `start_url: "./create.html"`, valid icons, and shortcuts to `#step-purpose` and `#step-theme`.

### Requirement: Dual-caching offline Service Worker
The system SHALL generate and register a Service Worker that pre-caches essential external CDN libraries (Tailwind CDN, DaisyUI, Lucide, Showdown) and the studio document to enable 100% offline usage.

#### Scenario: Loading studio without network connectivity
- **WHEN** user opens or navigates `create.html` while offline
- **THEN** the Service Worker serves cached CDN styles, icons, and document assets immediately with zero network errors.

### Requirement: In-studio PWA install trigger
The creation studio navigation bar SHALL include an install button that responds to the browser's `beforeinstallprompt` event and allows users to trigger native OS app installation directly from the UI.

#### Scenario: User clicks install button in navbar
- **WHEN** the browser fires `beforeinstallprompt` and user clicks the `#pwa-install-btn` in the navbar
- **THEN** the native app installation prompt is presented to the user, and upon acceptance, the button transitions to indicate installed status.

### Requirement: Conflict-free server with unique port 3030 and auto-hunting
The dev server and `/html-install` launcher SHALL default to dedicated port `3030` (or `process.env.HTML_REPORT_PORT || process.env.PORT`) and implement automatic port hunting (`3031`, `3032`, ...) if the primary port is occupied.

#### Scenario: Primary port occupied by another process
- **WHEN** port `3030` is already in use by another local process
- **THEN** the server detects `EADDRINUSE`, automatically increments and binds to the next available port (`3031`), and launches the browser to that URL without error termination.

### Requirement: Dynamic theme-color synchronization
The studio runtime SHALL observe changes to the active DaisyUI theme and update the `<meta name="theme-color">` tag dynamically to match the primary theme color.

#### Scenario: Theme changed in studio dropdown
- **WHEN** user selects a new theme (e.g., `emerald`, `synthwave`, `dracula`)
- **THEN** the document `<meta name="theme-color">` is updated to reflect the new theme's primary color in the OS window header.
