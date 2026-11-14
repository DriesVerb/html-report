# Spec Delta: mermaid-diagram-zoom

## Purpose

Provides interactive pan, multi-level zoom, smart aspect-ratio scaling, and fullscreen viewport controls for enlarged Mermaid diagrams in [skills/html-report/assets/template-shell.html](file:///home/eta/projects/html-report/skills/html-report/assets/template-shell.html) and [skills/html-report/assets/report-runtime.js](file:///home/eta/projects/html-report/skills/html-report/assets/report-runtime.js), eliminating microscopic unreadable text on wide flowcharts.

## ADDED Requirements

### Requirement: DaisyUI zoom & viewport toolbar
The enlarged diagram modal (`#mermaid-enlarge-modal`) SHALL provide a DaisyUI `join` button group containing Zoom In (`+`), Zoom Out (`-`), Zoom Level / Reset (`100%`), Fit to Viewport (`Fit`), and Fullscreen Modal Toggle.

#### Scenario: User clicks zoom in and zoom out buttons
- **WHEN** user clicks the `+` zoom button in the modal toolbar
- **THEN** the diagram scales up by 25% (clamped to max 400%), and the zoom level indicator reflects the current percentage (e.g. `125%`); clicking `-` scales down by 25% (clamped to min 25%).

### Requirement: Click-and-drag pan and mouse wheel zoom
The modal diagram viewport SHALL support click-and-drag panning (with `cursor: grab` / `cursor: grabbing`) and mouse wheel zooming centered at cursor position.

#### Scenario: User drags diagram while zoomed
- **WHEN** user holds primary mouse button and moves cursor within the diagram viewport
- **THEN** the diagram translates following the mouse movement with smooth GPU transform and zero text selection.

#### Scenario: User scrolls mouse wheel over diagram
- **WHEN** user scrolls up or down with mouse wheel inside the modal viewport
- **THEN** the diagram zooms in or out smoothly centered at the pointer coordinates.

### Requirement: Smart aspect-ratio initial sizing
Wide horizontal diagrams (`flowchart LR`, sequence diagrams with many actors) SHALL NOT be forced into `width: 100%` if doing so reduces diagram height below readable font thresholds.

#### Scenario: Wide diagram opened in modal
- **WHEN** a diagram with aspect ratio > 1.8:1 or width > 800px is opened in the enlarge modal
- **THEN** the system sets initial rendering scale to ensure legible typography (minimum text height ≥ 12px) and enables immediate horizontal panning rather than compressing the SVG into an unreadable strip.

### Requirement: Fullscreen modal expansion
The enlarge modal SHALL support a 1-click fullscreen toggle that expands the modal box to cover 98vw × 95vh for maximal viewing area.

#### Scenario: Fullscreen toggle clicked
- **WHEN** user clicks the expand/fullscreen button
- **THEN** the modal box transitions between standard container (`max-w-6xl`) and full-viewport mode (`max-w-[98vw] w-[98vw] h-[95vh]`).
