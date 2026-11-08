# Tasks: Settings Gear Menu Redesign & Tabbed Overview

## Phase 1: Section Consolidation & Download / Publish Switch (Priority 1)

- [x] 1.1 Rename "Export" section to "Download" (`#settings-section-download`, title "Download") in `skills/html-report/assets/template-shell.html` and `report-runtime.js`
- [x] 1.2 Add "Publish" toggle switch (`#settings-publish-toggle`) as the first item inside the "Download" section ahead of "Download as HTML"
- [x] 1.3 Remove standalone `publishing` section registration from `HTMLReportSettings` / `initAuthoring()` in `skills/html-report/assets/report-runtime.js`
- [x] 1.4 Wire the "Publish" switch inside the Download section to `HTMLReportPublisher.setPublished(on)` so toggling updates publish status and clean HTML export
- [x] 1.5 Preserve existing action IDs (`#download-html-btn`, `#download-pdf-btn`, `#pwa-install-dropdown-btn`) inside the Download menu for backward compatibility

## Phase 2: Unexpanded Collapsible Gear Menu Sections (Priority 1)

- [x] 2.1 Refactor gear dropdown sections into unexpanded/collapsed disclosures (`<details class="collapse collapse-arrow">` or DaisyUI collapse)
- [x] 2.2 Style the unexpanded "Appearance" header to display the title "Appearance" alongside the live color palette (`#active-theme-label` + 4 DaisyUI color swatch dots: primary, secondary, accent, neutral)
- [x] 2.3 Ensure expanding the "Appearance" accordion reveals the 32-theme swatch list (`#theme-swatch-list`) with scrollable viewport
- [x] 2.4 Ensure the "Download" section and any dynamically registered extension sections default to unexpanded/collapsed state

## Phase 3: "All Settings" Action & Tabbed Overview Modal (Priority 2)

- [x] 3.1 Add "All Settings" button (`#open-all-settings-btn`) with icon as the first option at the top of `#settings-panel`
- [x] 3.2 Add `#all-settings-modal` dialog to `skills/html-report/assets/template-shell.html` with tabbed navigation (`tabs tabs-boxed`)
- [x] 3.3 Implement Tab 1 ("Appearance"): theme switcher grid with active palette indicator
- [x] 3.4 Implement Tab 2 ("Download & Publishing"): Publish mode toggle switch, clean standalone download, PDF export, and PWA install
- [x] 3.5 Implement Tab 3 ("AI & Agent Bridge"): AI activation toggle for the board, live server connection status, and turnkey reconnection prompt generator
- [x] 3.6 Implement Tab 4 ("Page Editor"): Draft tasks summary and quick dock launcher
- [x] 3.7 Synchronize state between dropdown controls and modal tab controls (e.g., toggling publish switch or changing theme updates both views)

## Phase 4: A11y, Verification & Documentation (Priority 3)

- [x] 4.1 Verify keyboard navigation and a11y: Esc closes modal and dropdown, tab focus trap, `aria-expanded` and `role="tablist"` attributes
- [x] 4.2 Update test suite in `tests/settings-authoring.test.mjs` to verify: "All Settings" button, unexpanded headers, publish switch inside Download, and removal of standalone publishing section
- [x] 4.3 Run full test suite (`npm test`) and ensure all tests pass
- [x] 4.4 Update OpenSpec companion `index.html` and mirror to `implementation-progress.html` on `http://localhost:3000`
