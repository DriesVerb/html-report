# Design: Edit Mode Element Selection

## Context

See [proposal.md](file:///home/eta/projects/html-report/openspec/changes/edit-mode-element-selection/proposal.md) for motivation. The `html-report` architecture requires zero `node_modules` at runtime and strictly self-contained static execution. The edit dock currently captures section-level scroll context using `IntersectionObserver`. This design introduces element-level inspection and selection within the static browser runtime.

## Goals / Non-Goals

**Goals:**
- Provide a responsive toggle button `[⌖ Select]` in `#edit-dock-bar` adjacent to `+ Task`.
- Enable a zero-reflow, GPU-accelerated color inversion hover highlight strictly active during selection mode.
- Prevent default click behaviors (navigation, modal triggers) on page content while in selection mode.
- Guarantee an `#id` on every selected element via just-in-time semantic ID generation.
- Display a dedicated target badge in the compose menu without autofilling or polluting title/content text.
- Enrich deterministic prompts built by `HTMLReportEdit.buildEditPrompt()` with target element selectors.

**Non-Goals:**
- In-place WYSIWYG text or visual content manipulation (the report remains reader-centric; edits are compiled into prompts for AI agents or developers).
- Complex XPath or CSS selector query builders.
- Mass build-time ID stamping on every single HTML tag across reports.

## Decisions

### Decision 1: Scoped CSS Inversion Filter vs Floating Bounding Box
- **Choice**: Apply `.report-select-hover { filter: invert(1) hue-rotate(180deg) !important; }` on the hovered element during `pointerover`/`pointerout`.
- **Rationale**: Floating bounding boxes require recalculating `getBoundingClientRect()` on scroll, resize, or dynamic animation, which can feel laggy or flaky. CSS filters execute on the GPU with zero reflow, zero layout shift, and immediate responsiveness.
- **Alternatives Considered**: Direct `outline` (can clip under `overflow: hidden`), floating overlay div (can misalign during scroll).

### Decision 2: Just-in-Time Semantic ID Assignment
- **Choice**: When an element is clicked without an `id`, compute a semantic slug from its tag and first 20 characters of text content (e.g., `h2-revenue-trends` or `canvas-chart-1`), ensure document uniqueness, and assign `el.id`.
- **Rationale**: Keeps the DOM lightweight and free of unnecessary synthetic IDs until an element is explicitly selected for a task.
- **Alternatives Considered**: Generating IDs during build time for all elements (adds bloat), using raw DOM breadcrumb selectors (harder for human reading and prompts).

### Decision 3: Event Interception via Capture Phase
- **Choice**: Register click handlers with `addEventListener('click', onSelectClick, true)` during active selection mode.
- **Rationale**: Capture-phase listener executes before inner page event listeners, allowing `e.preventDefault()` and `e.stopPropagation()` to stop links from navigating and buttons from firing.
- **Alternatives Considered**: Overlay glass pane (blocks inspection of nested children).

### Decision 4: Isolated Target Element Badge (Zero Autofill)
- **Choice**: Show a dismissible badge (`Target: #id-xyz <tag> [✕]`) in the compose pane. Leave title and content inputs pristine.
- **Rationale**: Users want full freedom to articulate tasks in natural language without having to delete boilerplate text.
- **Alternatives Considered**: Pre-filling input fields with "Change text in #id" (cluttered, annoying to edit).

## Risks / Trade-offs

- **[Risk] Clicking deep inline children (e.g., `<span>`, `<strong>`, `<i>`)**:
  - *Mitigation*: Inspect `target.closest('h1, h2, h3, h4, h5, h6, p, canvas, table, tr, div.card, button, a')` or fallback to direct element if no higher landmark is matched.
- **[Risk] User interaction with dock while selecting**:
  - *Mitigation*: Exclude `#edit-dock` and its children from selection hover and click interception. Clicking inside the dock or pressing `Escape` cancels selection cleanly.
- **[Risk] Visual contrast across all 32 DaisyUI themes**:
  - *Mitigation*: Combining `invert(1)` with `hue-rotate(180deg)` ensures high contrast against both light and dark backgrounds.
