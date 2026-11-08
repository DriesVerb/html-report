# Proposal: `/html-install` — PWA App Packaging & Offline Creation Studio

## Why

The HTML Report Creation Studio ([create.html](file:///home/eta/projects/html-report/create.html)) is the central decision engine, OKLCH theme studio, and deterministic prompt generator across the entire reporting suite. However, developers and analysts currently access it via transient browser tabs through dev server scripts or static file links.

When working offline (on trains, flights, or disconnected secure sandboxes), the studio's CDN dependencies (Tailwind CSS, DaisyUI, Lucide icons, Showdown) fail to render without internet connectivity. Furthermore, users lack a distraction-free, dedicated desktop application experience with standalone OS window chrome, dock/taskbar pinning, and instant keyboard access.

Introducing **`/html-install`** provides a dedicated 1-click installer and launcher that transforms the Creation Studio into an offline-resilient, installable Progressive Web App (PWA) with native window frames, offline asset caching, dynamic theme sync, and an automated desktop installation workflow.

## What Changes

1. **New Slash Command & Skill Facade (`/html-install`)**:
   - Provide a zero-friction command `/html-install` that prepares, serves, and installs the HTML Creation Studio ([create.html](file:///home/eta/projects/html-report/create.html)) as a native PWA on macOS, Windows, Linux desktop, iOS, and Android.
   - Support optional target argument (`/html-install [file.html]`) to install any existing report or dashboard as a standalone PWA.

2. **Full PWA Scaffolding for HTML Creation Studio**:
   - Emit W3C Web App Manifest ([manifest.webmanifest](file:///home/eta/projects/html-report/manifest.webmanifest)) configured for standalone app display, categories (`productivity`, `developer`, `utilities`), crisp SVG vector app icon, and deep-link navigation shortcuts.
   - Emit dual-caching Service Worker ([sw.js](file:///home/eta/projects/html-report/sw.js)) configured to pre-cache core CDN assets (Tailwind CDN, DaisyUI 4 CSS, Lucide Icons, Showdown) for 100% offline functionality.
   - Dynamic `<meta name="theme-color">` runtime observer synchronizing with the active DaisyUI theme.

3. **In-Studio Installation UX**:
   - Add a prominent **[⬇ Install App]** button in the [create.html](file:///home/eta/projects/html-report/create.html) sticky header navbar.
   - Implement `beforeinstallprompt` event interception with 1-click native browser install prompt invocation.
   - Display an **Offline Ready** badge and toast confirmation once the Service Worker pre-caching sequence successfully completes.

4. **1-Command Node & Shell Launchers with Conflict-Free Port 3030**:
   - Create `skills/html-create/scripts/install-pwa.mjs` and executable shell wrapper `skills/html-create/scripts/install-pwa.sh` that automate PWA asset generation, launch a local HTTP host on dedicated port `3030`, and open the install dialog in the default browser.
   - Implement automatic port-hunting (`3031`, `3032`, ...) to gracefully handle port collisions.
   - Register npm script `"install:wizard"` and bin alias in [package.json](file:///home/eta/projects/html-report/package.json).

5. **Interactive Diagram Zoom, Pan & Fullscreen Viewport**:
   - Upgrade `#mermaid-enlarge-modal` in [template-shell.html](file:///home/eta/projects/html-report/skills/html-report/assets/template-shell.html) with DaisyUI `join` zoom toolbar: Zoom In (`+`), Zoom Out (`-`), Reset (`100%`), Fit to Viewport, and Maximize Fullscreen.
   - Implement zero-dependency GPU-accelerated pan-and-drag and mouse wheel zoom in [report-runtime.js](file:///home/eta/projects/html-report/skills/html-report/assets/report-runtime.js).
   - Implement smart aspect-ratio initial scaling so wide `flowchart LR` diagrams render with legible typography instead of compressing into microscopic strips.

## Capabilities

### New Capabilities
- `html-wizard-pwa-install`: 1-click PWA packaging, offline service worker caching, and native installation orchestration for the HTML Report Creation Studio and sibling reports.
- `mermaid-diagram-zoom`: Interactive pan, multi-level zoom (25%–400%), smart aspect-ratio scaling, and fullscreen viewport controls for enlarged Mermaid diagrams.

### Modified Capabilities
- `html-create`: Extended with navbar PWA install trigger, service worker registration script, and offline readiness indicators.
- `html-pwa`: Reusable PWA builder engine leveraged to package the interactive studio.
- `html-report`: Upgraded `#mermaid-enlarge-modal` runtime with zoom toolbar, grab-and-drag panning, and wide diagram readability.

## Impact

- **Core Files**:
  - [create.html](file:///home/eta/projects/html-report/create.html) / [skills/html-report/assets/create.html](file:///home/eta/projects/html-report/skills/html-report/assets/create.html): PWA manifest links, install button, SW registration.
  - [skills/html-create/scripts/install-pwa.mjs](file:///home/eta/projects/html-report/skills/html-create/scripts/install-pwa.mjs): Standalone installer script.
  - [skills/html-create/scripts/install-pwa.sh](file:///home/eta/projects/html-report/skills/html-create/scripts/install-pwa.sh): Instant cross-platform shell launcher.
  - [skills/html-create/SKILL.md](file:///home/eta/projects/html-report/skills/html-create/SKILL.md) & [skills/html-pwa/SKILL.md](file:///home/eta/projects/html-report/skills/html-pwa/SKILL.md): Command documentation and workflow links.
  - [package.json](file:///home/eta/projects/html-report/package.json): Convenience scripts and bin exports.
- **Dependencies**: Zero new runtime dependencies. Built exclusively on Node.js built-ins (`node:fs`, `node:path`, `node:http`, `node:child_process`) and web platform APIs (Service Worker, Web App Manifest, Cache API).
