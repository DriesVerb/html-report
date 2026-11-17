# Tasks: Agentic Ease of Use README & GitHub Pages Showcase with Bonus HTML Studio

## 1. Core Runtime Markdown Viewer
- [x] 1.1 Add `ensureMarkdownViewerModal()`, `resolveMarkdownArtifact()`, `openMarkdownViewer()`, and `closeMarkdownViewer()` to `packages/core/assets/runtime/05-cdn-hydrators.js`
- [x] 1.2 Expose `openMarkdownViewer` and `closeMarkdownViewer` in `08-publisher-and-board.js` and `report-runtime.js`

## 2. Live Static `html-studio` Entrypoint for GitHub Pages
- [x] 2.1 Copy `manifest.webmanifest`, `icon.svg`, and `sw.js` into `packages/studio/assets/`
- [x] 2.2 Create root `studio.html` redirecting cleanly to `./packages/studio/assets/create.html`

## 3. Restructure `README.md`
- [x] 3.1 Lead with 1-Prompt Agent Install, Agentic Advantage table, 3-Step Agentic Loop, and 5 Deliverable Skills
- [x] 3.2 Add Bonus `html-studio` section with live GitHub Pages links and keep total length <= 200 lines while preserving SemVer & all `docs/*.md` links

## 4. Redesign GitHub Pages Showcase (`index.html`)
- [x] 4.1 Author `showcase-fragment.html` explaining the concept briefly, showcasing features across the 7-tab Capability Explorer, and highlighting Bonus `html-studio` links
- [x] 4.2 Compile root `index.html` via `build-report.mjs` with `--all-addons --published`

## 5. OpenSpec Companion & Verification
- [x] 5.1 Sync updated specification to `openspec/specs/modular-documentation-and-showcase/spec.md`
- [x] 5.2 Build companion `index.html` and mirror to `implementation-progress.html` on `http://localhost:3031`
- [x] 5.3 Run `npm test` and E2E tests (`modular-documentation-and-showcase.bdd.test.mjs`, `browser-runtime-integrity.test.mjs`)
