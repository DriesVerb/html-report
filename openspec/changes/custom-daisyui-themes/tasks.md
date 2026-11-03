# Tasks: User-Defined Custom DaisyUI Themes

## Phase 1: Pure JS OKLCH Engine & DaisyUI Compiler (D1, D3, D4)
- [x] 1.1 Implement pure JS color conversion utility (`sRGB` to OKLCH `L% C H` string representation).
- [x] 1.2 Implement automatic contrast generator for `-content` variables (`--pc`, `--sc`, etc.).
- [x] 1.3 Implement theme compiler supporting JSON definitions, base theme inheritance (`extends`), and raw CSS.
- [x] 1.4 Add unit tests verifying color conversion accuracy, inheritance, and CSS output matching DaisyUI 4 specification.

## Phase 2: Build-Time & CLI Integration (D1)
- [x] 2.1 Update `scripts/build-report.mjs` to accept `--custom-theme <path>` (supporting JSON and CSS).
- [x] 2.2 Inject custom theme CSS into template shell `<style id="daisyui-custom-themes">`.
- [x] 2.3 Ensure custom theme names are recognized and selectable via `--theme <name>`.
- [x] 2.4 Add build test verifying custom theme builds deterministically with matching palette.

## Phase 3: Runtime Registration & Top Collapsible Studio in example.html (D2)
- [x] 3.1 Update `report-runtime.js` to register dynamic custom themes into `DAISYUI_THEMES`.
- [x] 3.2 Update `initThemeDropdown()` to display custom themes with swatches.
- [x] 3.3 Create Top Collapsible Accordion (`collapse collapse-arrow`) in `example.html` with real-time color pickers and base theme dropdown.
- [x] 3.4 Wire real-time live preview updating DOM, Chart.js instances, and Mermaid diagrams.
- [x] 3.5 Implement `localStorage` persistence and one-click export (DaisyUI CSS & Tailwind config).

## Phase 4: Verification & Documentation
- [x] 4.1 Run Playwright responsive checks across custom themes.
- [x] 4.2 Verify dynamic palette resolution with Chart.js and Mermaid when switching custom themes.
- [x] 4.3 Update `skills/html-report/SKILL.md` and project README with theme customization instructions.
