# custom-daisyui-themes Specification

## Requirements

### Requirement: DaisyUI Specification Alignment & Format Support
The custom theme engine MUST accept DaisyUI 4 theme definitions formatted either as CSS rules or as JSON configuration objects.
* All semantic colors (`primary`, `secondary`, `accent`, `neutral`, `base-100`, `base-200`, `base-300`, `base-content`, `info`, `success`, `warning`, `error`) MUST be mapped to DaisyUI CSS variables (`--p`, `--s`, `--a`, `--n`, `--b1`, `--b2`, `--b3`, `--bc`, etc.).
* Standard color inputs (Hex, RGB, HSL) MUST be converted into DaisyUI 4 OKLCH space (`<L>% <C> <H>`).
* Component geometry variables (`--rounded-box`, `--rounded-btn`, `--rounded-badge`, `--animation-btn`, `--animation-input`, `--btn-focus-scale`, `--border-btn`, `--tab-border`, `--tab-radius`) MUST be preserved and injected.

#### Scenario: Build-Time Theme Injection from JSON
* **GIVEN** a theme JSON file specifying custom colors `{ "primary": "#10b981", "base-100": "#0f172a" }`
* **WHEN** `build-report.mjs` is executed with `--custom-theme <path>`
* **THEN** the output HTML contains a `<style id="daisyui-custom-themes">` block containing the corresponding `[data-theme="custom-name"]` selector with correct OKLCH variables.

#### Scenario: Raw CSS Block Passthrough
* **GIVEN** a raw CSS file containing `[data-theme="acme"] { --p: 45% 0.25 260; }`
* **WHEN** `build-report.mjs` is executed with `--custom-theme acme.css`
* **THEN** the exact CSS block is injected into `<style id="daisyui-custom-themes">` and `acme` is added to the theme dropdown.

### Requirement: Base Theme Inheritance
The theme engine MUST support an `"extends": "<themeName>"` property in theme definitions. When specified, unspecified semantic and geometry variables MUST inherit values from the referenced DaisyUI base theme.

#### Scenario: Extending an Existing Base Theme
* **GIVEN** a theme JSON specifying `{ "acme-dark": { "extends": "dark", "primary": "#3b82f6" } }`
* **WHEN** the theme is compiled
* **THEN** the generated `[data-theme="acme-dark"]` inherits the base backgrounds and neutral tokens of `dark`, but overrides `--p` with the OKLCH values for `#3b82f6`.

### Requirement: Zero-Dependency Color Conversion
The runtime and build scripts MUST perform sRGB-to-OKLCH transformations using self-contained JavaScript matrix math without requiring external CDN color libraries.

#### Scenario: Inlined Color Conversion Accuracy
* **GIVEN** a valid hex color string `#3b82f6`
* **WHEN** the pure JS OKLCH converter processes the color
* **THEN** it outputs an OKLCH string matching `62.3% 0.214 259.8` within 1% perceptual tolerance without loading external scripts.

### Requirement: In-Browser Top Collapsible Studio & Persistence
Reports and showcases MUST provide a Top Collapsible Theme Studio defaulting to a collapsed state (48px banner) located beneath the document title.
* Expanding the accordion MUST reveal real-time color pickers and base theme selectors.
* Changes made in the studio MUST apply live to the document DOM, Chart.js instances, and Mermaid diagrams without page reloads.
* User themes MUST persist in browser `localStorage` under `html_report_custom_themes`.
* The studio MUST provide export buttons generating valid DaisyUI CSS (`[data-theme="..."] { ... }`) and Tailwind config snippets.

#### Scenario: In-Browser Live Theme Studio Interaction
* **GIVEN** an active report rendered in the browser with the top collapsible studio
* **WHEN** the user expands the accordion and updates the Primary color
* **THEN** the document's `data-theme` updates immediately, active Chart.js and Mermaid diagrams dynamically reflect the new palette colors, and the theme is saved in `localStorage`.
