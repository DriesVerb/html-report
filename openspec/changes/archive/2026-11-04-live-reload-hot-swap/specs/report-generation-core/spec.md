# Spec Delta: report-generation-core

## MODIFIED Requirements

### Requirement: DaisyUI Theme Dropdown with Default Light Theme, Color-Scheme Swatch Previews, and Live Chart Synchronization
Every generated HTML report SHALL default to the `light` DaisyUI theme (`<html data-theme="light">`), display all 32 built-in DaisyUI themes in a dropdown where each theme option previews its own color scheme (`bg-base-100`, `text-base-content`, and `bg-primary`, `bg-secondary`, `bg-accent`, `bg-neutral` swatches inside `data-theme="<theme>"`), and dynamically update Chart.js instances, Mermaid diagrams, and CSS-themed components when switching themes. When the user has previously selected a theme, the report SHALL restore that theme before the first paint, so the default theme is never briefly shown.

#### Scenario: Loading default light theme and selecting a DaisyUI theme with color swatches
- **WHEN** a report loads initially or a user selects a theme from the navbar dropdown
- **THEN** the initial theme is `light`, each dropdown item displays its 4 color swatches, `<html data-theme="...">` updates immediately, and all Chart.js, Mermaid, and Grid.js elements recompute their palette colors from the active DaisyUI theme variables

#### Scenario: Reloading a report after selecting a theme
- **GIVEN** the user previously selected the `dark` theme in a report
- **WHEN** the report is reloaded or reopened in the same browser
- **THEN** the first rendered frame already uses the `dark` theme, with no visible flash of the `light` theme

## ADDED Requirements

### Requirement: Live-Reload State Preservation
When the live-reload dev server detects a change to a served report and only the report's main content changed, the open tab SHALL update that content in place without a full page reload. The active theme, scroll position, and other client-side page state SHALL be kept.

#### Scenario: Content-only change while a themed, scrolled report is open
- **GIVEN** a report served by the dev server is open with the `dark` theme and scrolled partway down
- **WHEN** only text or markup inside the report's main content changes on disk
- **THEN** the tab shows the updated content without a full page reload, the theme stays `dark`, the scroll position is unchanged, and the Table of Contents and Mermaid diagrams reflect the new content

### Requirement: Live-Reload Fallback with Scroll Restoration
When an in-place update is not safe or not possible, the dev server's live-reload client SHALL fall back to a full page reload and SHALL then restore the previous scroll position and theme. This applies when `<head>` assets or inline scripts changed, when the page has no main content element, or when the in-place update mechanism is unavailable.

#### Scenario: Inline script change triggers fallback reload
- **GIVEN** a report served by the dev server is open with the `dark` theme and scrolled partway down
- **WHEN** an inline script or a `<head>` asset of the report changes on disk
- **THEN** the tab performs a full reload, the new script runs, and after load the theme is `dark` and the scroll position is restored to where it was

#### Scenario: In-place update mechanism unavailable
- **WHEN** a report changes on disk while the browser cannot load the in-place update mechanism (for example, offline)
- **THEN** the tab performs a full reload and restores the previous scroll position instead of failing silently
