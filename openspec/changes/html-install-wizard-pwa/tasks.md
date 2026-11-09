# Tasks: `/html-install` — PWA App Packaging & Offline Creation Studio

## 1. PWA Asset Generation & Studio Configuration

- [x] 1.1 Configure Studio PWA metadata and icon generation (monogram / sparkle glyph, `manifest.webmanifest`, `icon.svg`) via [skills/html-report/scripts/pwa-builder.mjs](file:///home/eta/projects/html-report/skills/html-report/scripts/pwa-builder.mjs)
- [x] 1.2 Implement offline Service Worker pre-caching for Tailwind CDN, DaisyUI 4 CSS, Lucide Icons, and Showdown in [skills/html-report/scripts/pwa-builder.mjs](file:///home/eta/projects/html-report/skills/html-report/scripts/pwa-builder.mjs)
- [x] 1.3 Fix root `manifest.webmanifest`, `sw.js`, and `icon.svg` studio assets (resolving legacy PokéLive artifact clash) and add studio manifest route in `serve-report.mjs`

## 2. In-Studio Installation UI & Runtime

- [x] 2.1 Add responsive `#pwa-install-btn` and status badge in the navbar of [create.html](file:///home/eta/projects/html-report/create.html) and [skills/html-report/assets/create.html](file:///home/eta/projects/html-report/skills/html-report/assets/create.html)
- [x] 2.2 Wire `beforeinstallprompt` event interception, `triggerPwaInstall()`, and post-install UI state updates in [create.html](file:///home/eta/projects/html-report/create.html)
- [x] 2.3 Add dynamic `<meta name="theme-color">` observer in [create.html](file:///home/eta/projects/html-report/create.html) to sync OS frame colors with active DaisyUI theme

## 3. Installer Script & Slash Command Launcher

- [x] 3.1 Implement standalone installer script [skills/html-report/scripts/install-pwa.mjs](file:///home/eta/projects/html-report/skills/html-report/scripts/install-pwa.mjs) supporting zero-arg wizard install and optional custom report paths
- [x] 3.2 Implement fast bash launcher [skills/html-report/scripts/install-pwa.sh](file:///home/eta/projects/html-report/skills/html-report/scripts/install-pwa.sh) with cross-platform desktop browser launching
- [x] 3.3 Register npm scripts and bin aliases in [package.json](file:///home/eta/projects/html-report/package.json) (`"install:wizard"`, `"html-report-install"`)
- [x] 3.4 Adopt unique non-colliding default port (with automatic `EADDRINUSE` port-hunting fallback) across dev servers and launchers

## 4. Documentation & Sibling Skill Routing

- [x] 4.1 Document `/html-install` slash command and workflow in [skills/html-create/SKILL.md](file:///home/eta/projects/html-report/skills/html-create/SKILL.md) and [skills/html-pwa/SKILL.md](file:///home/eta/projects/html-report/skills/html-pwa/SKILL.md)
- [x] 4.2 Update README and skill references with PWA installation commands

## 5. Automated Verification & Testing

- [x] 5.1 Add automated test suite in `tests/html-install-pwa.test.mjs` verifying manifest generation, SW pre-cache list, HTML tag injection, and CLI arguments
- [x] 5.2 Execute test suite via `npm test` and verify zero regressions across existing report suites

## 6. Interactive Diagram Zoom, Pan & Fullscreen Viewport

- [x] 6.1 Add DaisyUI `join` toolbar controls (`[ - ]`, `[ 100% / Reset ]`, `[ + ]`, `[ ⛶ Fit ]`, `[ ⤢ Fullscreen ]`) to `#mermaid-enlarge-modal` in [skills/html-report/assets/template-shell.html](file:///home/eta/projects/html-report/skills/html-report/assets/template-shell.html)
- [x] 6.2 Implement GPU-accelerated pan & zoom engine in [skills/html-report/assets/report-runtime.js](file:///home/eta/projects/html-report/skills/html-report/assets/report-runtime.js) (`transform: scale() translate()`, mouse wheel zoom, click-and-drag pan, keyboard `+`/`-`/`0`/`ESC`)
- [x] 6.3 Implement smart aspect-ratio initial sizing in [skills/html-report/assets/report-runtime.js](file:///home/eta/projects/html-report/skills/html-report/assets/report-runtime.js) (prevent wide horizontal `flowchart LR` diagrams from shrinking to microscopic scale)
- [x] 6.4 Add automated tests in `tests/mermaid-zoom.test.mjs` verifying zoom scale clamping, pan offsets, and toolbar actions
