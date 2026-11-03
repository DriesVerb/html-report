# Proposal: User-Defined Custom DaisyUI Themes

## Why
While `html-report` supports the complete suite of 32 official DaisyUI themes out of the box, real-world reporting demands custom corporate branding, client design tokens, and bespoke colorways. Currently, users have no standard mechanism to register custom themes without manually editing the generated HTML and runtime scripts.

daisyUI defines themes via a rigorous, predictable CSS variable specification (OKLCH color channels, semantic color roles, content contrast pairs, and component geometry metrics). By supporting user-defined custom themes that conform 100% to the DaisyUI theming specification, authors can:
1. Deliver reports styled with their organization's exact brand identities.
2. Interactively customize, preview, and test themes live in the browser.
3. Define custom themes statically via CLI / build scripts using standard DaisyUI JSON or CSS syntax.
4. Export theme definitions directly for use in standard DaisyUI / Tailwind projects.

---

## Confirmed Architectural Decisions
During brainstorming, the following design decisions were established:
* **D1 (Format)**: Hybrid support for standard DaisyUI JSON configuration objects (with automatic sRGB to OKLCH conversion and content auto-contrast) as well as raw `[data-theme="..."]` CSS blocks.
* **D2 (Studio & Layout)**: Top Collapsible Accordion (`collapse collapse-arrow`) placed right beneath the hero in `example.html`, defaulting to a compact 48px collapsed banner, expanding to full color pickers/sliders, with the entire 11-CDN showcase underneath reacting live.
* **D3 (Color Engine)**: Zero-dependency pure JavaScript matrix math inlined into the runtime (`sRGB -> Linear RGB -> CIE XYZ -> OKLab -> OKLCH`), eliminating external CDN dependencies.
* **D4 (Inheritance)**: Support for base theme inheritance (`"extends": "<theme-name>"`), allowing users to override specific colors (e.g. only `primary` or `neutral`) while inheriting the remainder of an existing DaisyUI theme (such as `dark` or `emerald`).

---

## What Changes

### 1. Full Alignment with the DaisyUI Theming Specification
A custom theme adheres strictly to the official DaisyUI structure:
* **Semantic Palette Variables**:
  * Base tokens: `primary`, `secondary`, `accent`, `neutral`, `base-100`, `base-200`, `base-300`, `info`, `success`, `warning`, `error`.
  * Content tokens: Auto-calculated or explicitly set contrast tokens (`primary-content`, `base-content`, etc.).
  * Color-scheme metadata: `color-scheme: light | dark` to ensure native OS scrollbars and browser controls match.
* **Component Geometry & Animation Tokens**:
  * `--rounded-box` (card and modal corners)
  * `--rounded-btn` (button corners)
  * `--rounded-badge` (badge corners)
  * `--animation-btn`, `--animation-input`, `--btn-focus-scale`, `--border-btn`, `--tab-border`, `--tab-radius`.
* **OKLCH Math & Fallback Engine**:
  * Translates hex/rgb colors into DaisyUI 4 OKLCH space (`<L>% <C> <H>`) so daisyUI's `oklch(var(--p) / <alpha>)` rules function natively.

### 2. Dual Definition Workflows: Build-Time & In-Browser Studio
* **Build-Time (CLI & Deterministic Pipeline)**:
  * Pass `--custom-theme <file.json|file.css>` or configure inline in `build-report.mjs`.
  * Injects `[data-theme="custom-name"] { ... }` into `<style id="daisyui-custom-themes">`.
  * Automatically registers custom theme entries into the navbar swatch picker.
* **In-Browser Interactive Theme Builder (Web-First)**:
  * A top collapsible customizer in `example.html` right beneath the title.
  * Real-time color pickers for key semantic roles with auto-contrast generation for content text.
  * Live updates across all report elements, Chart.js instances, and Mermaid diagrams.
  * LocalStorage persistence to retain custom user themes across sessions.
  * One-click export to **DaisyUI CSS** or **Tailwind CSS config (`daisyui.themes`)**.

---

## Capabilities

### New Capabilities
* `custom-daisyui-themes`: Parsing, validating, and compiling custom DaisyUI themes (JSON or CSS format), OKLCH color channel conversion, dynamic theme registration in the switcher, base theme inheritance, and in-browser interactive theme editing with live Chart/Mermaid synchronization.

---

## Impact
* **Affected Files**:
  * `skills/html-report/assets/report-runtime.js` (theme registry expansion, OKLCH converter, local storage custom theme loader, interactive editor hook)
  * `skills/html-report/assets/template-shell.html` (custom theme styles injection slot)
  * `skills/html-report/examples/example.html` (top collapsible Theme Studio component)
  * `skills/html-report/scripts/build-report.mjs` (CLI `--custom-theme` argument parsing, theme compilation, and CSS injection)
  * `skills/html-report/SKILL.md` (documentation on how to supply and customize themes)
* **Backward Compatibility**:
  * 100% backward compatible with existing reports. The 32 standard themes remain default and unmodified.
