# Design: Quill WYSIWYG Editor Addon & Wizard Dual-Mode Input

## Context
See [proposal.md](file:///home/eta/projects/html-report/openspec/changes/quill-wysiwyg-editor/proposal.md) for background and motivation.
The repository generates zero-build, CDN-backed single-file HTML reports. `create.html` serves as the interactive onboarding wizard, theme studio, and prompt generator. Currently, Section A (Visual & Data Components) lists Chart.js, Mermaid, Grid.js, Leaflet, KaTeX, FullCalendar, Showdown, Highlight.js, and Day.js. Under *"Describe what you want to build"*, user objectives are entered via a single plain `<textarea id="input-board-goals">`.

## Goals / Non-Goals

**Goals:**
- Register Quill v2.0 as a canonical on-demand addon in [build-report.mjs](file:///home/eta/projects/html-report/skills/html-report/scripts/build-report.mjs) and [domain-model.mjs](file:///home/eta/projects/html-report/skills/html-report/scripts/domain-model.mjs).
- Add Quill as an interactive visual component checkbox (`#chk-quill`) in Section A of [create.html](file:///home/eta/projects/html-report/create.html).
- Provide a responsive dual-mode switcher (`Simple` vs `Complex`) above the *"Tell what the board needs to show"* input field.
- Simple mode exposes a clean `<textarea>`, while Complex mode activates an embedded Quill editor with formatting controls (headings, bold, italic, lists, code-blocks).
- Implement bidirectional synchronization between Simple and Complex inputs.
- Persist goals and active mode in `localStorage`.
- Format board goals cleanly into the AI prompt output (`#prompt-output-box`), translating rich-text elements to compact Markdown for LLM scaffolding.

**Non-Goals:**
- Forcing users into rich text; Simple mode remains the default or user-selected preference.
- Requiring Node.js or bundlers; Quill is loaded strictly via jsDelivr CDN.
- Heavy enterprise plugins (image uploaders, server file managers); the editor focuses on executive briefs and structured requirements.

## Decisions

### 1. Editor Library: Quill.js 2.0 (Snow Theme)
*Rationale*: Quill 2.0 has an MIT license, zero dependencies, requires no API key or cloud registration, outputs clean semantic HTML (`quill.getSemanticHTML()`), and loads from two CDN links:
- CSS: `https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css`
- JS: `https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js`
*Alternatives Considered*:
- *TinyMCE*: Rejected due to mandatory cloud API keys and GPL copyleft licensing.
- *Trix*: Clean, but lacks built-in heading levels and flexible toolbar theming.

### 2. Dual-Mode Architecture in `create.html`
The UI will render segmented toggle buttons above the input:
```html
<div class="flex items-center justify-between mb-1">
  <label class="text-3xs font-semibold text-base-content/80">
    Tell what the board needs to show:
  </label>
  <div class="join border border-base-300 rounded-md p-0.5 bg-base-200/50">
    <button type="button" id="btn-mode-simple" class="btn btn-2xs join-item btn-primary" onclick="switchBoardGoalMode('simple')">Simple</button>
    <button type="button" id="btn-mode-complex" class="btn btn-2xs join-item btn-ghost" onclick="switchBoardGoalMode('complex')">Complex (Quill)</button>
  </div>
</div>
```
- `#input-board-goals` (`<textarea>`) renders in Simple mode.
- `#quill-board-goals-container` renders in Complex mode with an inner `#quill-board-goals-editor`.

### 3. Bidirectional Sync & Prompt Conversion
- When switching from Simple to Complex: `quill.setText(textarea.value)`.
- When switching from Complex to Simple: `textarea.value = quill.getText().trim()`.
- When generating the AI Prompt (`updatePromptAndPreview`):
  - In Simple mode: `textarea.value.trim()`.
  - In Complex mode: convert HTML paragraphs and lists into clean bulleted text/markdown so the prompt is immediately readable by LLM coding agents without raw tag noise.

### 4. DaisyUI Theme Integration for Quill Snow
Quill's default snow theme assumes a light background with static gray borders. To harmonize with DaisyUI's 32 themes, we inject scoped CSS variables:
```css
.ql-toolbar.ql-snow {
  border-color: var(--fallback-b3,oklch(var(--b3)/var(--tw-border-opacity,1))) !important;
  background-color: var(--fallback-b2,oklch(var(--b2)/0.4)) !important;
  border-top-left-radius: 0.5rem;
  border-top-right-radius: 0.5rem;
}
.ql-container.ql-snow {
  border-color: var(--fallback-b3,oklch(var(--b3)/var(--tw-border-opacity,1))) !important;
  background-color: var(--fallback-b1,oklch(var(--b1)/1)) !important;
  color: var(--fallback-bc,oklch(var(--bc)/1)) !important;
  border-bottom-left-radius: 0.5rem;
  border-bottom-right-radius: 0.5rem;
}
.ql-snow .ql-stroke {
  stroke: var(--fallback-bc,oklch(var(--bc)/0.7)) !important;
}
.ql-snow .ql-fill {
  fill: var(--fallback-bc,oklch(var(--bc)/0.7)) !important;
}
```

## Risks / Trade-offs

- **[CDN Availability / Offline Execution]** → *Mitigation*: Service worker cache in `sw.js` caches the Quill 2.0 CDN resources so offline PWA operation continues uninterrupted.
- **[Token Overhead in AI Prompts]** → *Mitigation*: Convert Quill delta/HTML to compact structured Markdown lines rather than raw nested HTML elements before embedding into `#prompt-output-box`.
