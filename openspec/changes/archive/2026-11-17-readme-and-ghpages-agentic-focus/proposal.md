# Proposal: Agentic Ease of Use README & GitHub Pages Showcase with Bonus HTML Studio

## Why

While `html-report` has grown into a rich multi-skill ecosystem (`@html-report/core` + `@html-report/studio` + 5 specialized output skills), the root `README.md` and GitHub Pages showcase (`index.html`) did not clearly lead with **agentic ease of use** or position `html-studio` accurately:

1. Users and AI agents visiting the repo need an immediate grasp of the **core loop**: paste 1 prompt to install, emit only a small semantic fragment (`~70%` token savings), assemble deterministically in `<100ms`, and iterate via Two-Way Visual Edit Mode.
2. The 5 specialized output skills (`/html-report`, `/html-dashboard`, `/html-presentation`, `/html-print`, `/html-pwa`) need clear visibility right in `README.md` and GitHub Pages.
3. `html-studio` (`/html-studio`, `@html-report/studio`) should be presented clearly as a **bonus interactive companion** rather than competing with the core agentic workflow—while giving GitHub Pages visitors a **direct working link** to the latest live browser version (`studio.html` / `packages/studio/assets/create.html`).

## What Changes

- **Core Runtime Built-In Showdown Markdown Viewer**:
  - Add `openMarkdownViewer()` and `closeMarkdownViewer()` directly in `packages/core/assets/runtime/05-cdn-hydrators.js` (and expose/export in `08-publisher-and-board.js` and `report-runtime.js`) so every assembled report can preview `.md` files via `#markdown-viewer-modal` out of the box.
- **Live GitHub Pages `html-studio` Entrypoint**:
  - Copy `manifest.webmanifest`, `icon.svg`, and `sw.js` into `packages/studio/assets/` so static GitHub Pages hosting resolves studio PWA assets with zero 404s.
  - Add root `studio.html` redirecting cleanly to `./packages/studio/assets/create.html` so `https://driesverb.github.io/html-report/studio.html` works directly.
- **Restructure `README.md` (<= 200 lines)**:
  - Lead with 1-Prompt Agent Install, the Agentic Advantage benchmark table, and the 3-Step Agentic Loop (Semantic Fragment -> `<100ms` Build -> Live Preview & Visual Edit Mode).
  - Showcase the 5 Deliverable Skills in a concise table.
  - Present `/html-studio` as a Bonus Interactive Companion with direct links to the live GitHub Pages studio and local instant launcher.
  - Retain SemVer badges, `Semantic Versioning & Downstream Integration`, and all 7+ documentation links.
- **Redesign GitHub Pages Showcase (`index.html`)**:
  - Briefly explain the core concept (3-Step Agentic Workflow + 5 Deliverable Skills).
  - Showcase interactive features via the 7-tab Capability Explorer (Chart.js, Mermaid with Enlarge, Grid.js, Leaflet, Datastar Telemetry, KaTeX + Highlight.js, FullCalendar + Mock.js).
  - Add a dedicated **Bonus: HTML Studio** section and hero CTA linking directly to `packages/studio/assets/create.html` and `studio.html`.
  - Wire the Documentation Hub cards and embedded `MARKDOWN_ARTIFACTS` to the Showdown viewer modal.
- **OpenSpec Companion (`localhost:3031`)**:
  - Maintain `openspec/changes/readme-and-ghpages-agentic-focus/index.html` mirrored to `implementation-progress.html`.

## Impact

- `README.md`, `index.html`, `studio.html`
- `packages/core/assets/runtime/05-cdn-hydrators.js`, `08-publisher-and-board.js`, `report-runtime.js`
- `packages/studio/assets/{manifest.webmanifest,icon.svg,sw.js}`
- `openspec/specs/modular-documentation-and-showcase/spec.md`
