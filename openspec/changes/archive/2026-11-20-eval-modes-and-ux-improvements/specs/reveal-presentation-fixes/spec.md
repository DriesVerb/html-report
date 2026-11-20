# Delta Specification: reveal-presentation-fixes

## MODIFIED Requirements

### Requirement: Embedded Reveal.js Widget & TOC Synchronization
When Reveal.js is active inside the DaisyUI template shell, `.reveal` and `.reveal-viewport` SHALL use a transparent background over `.reveal-stage` so dark DaisyUI themes render without white paint, `#presentation-notes-modal.hidden` SHALL start hidden (`display: none !important`), hidden-slide `.mermaid` diagrams SHALL render offscreen via `mermaid.render()` when `isMermaidContainerHidden(node)` is true so SVGs do not collapse to 16px, hidden-slide Leaflet maps and Chart.js canvases SHALL synchronize automatically on slide transitions, and `initTOC()` / `StructureCheck` SHALL exclude `#print-cover-page`, `.notes`, and `#presentation-notes-modal` headings.

#### Scenario: Switching to a slide containing Leaflet or Chart.js
- **GIVEN** a Reveal.js slide deck where `#map` or a `<canvas>` resides on Slide 2 or later
- **WHEN** the user navigates to that slide via keyboard, controls, or navbar TOC link
- **THEN** Reveal.js switches to that slide, calls `invalidateSize()` on Leaflet maps and `resize()` on `window.reportCharts`, and keeps Leaflet panes below the `z-50` sticky navbar.

#### Scenario: Dark theme presentation deck renders transparent stage, hidden notes modal, and offscreen Mermaid SVG
- **GIVEN** a Reveal.js presentation compiled with `--mode presentation --theme night` containing a `.mermaid` diagram on Slide 2 and speaker notes
- **WHEN** the presentation loads at `1280x800`
- **THEN** `.reveal-stage .reveal` does not paint an opaque `rgb(255, 255, 255)` background, `#presentation-notes-modal` starts with computed `display: none`, and Slide 2's `.mermaid svg` renders with full non-collapsed `viewBox` dimensions.
