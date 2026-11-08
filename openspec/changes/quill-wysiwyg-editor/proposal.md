# Proposal: Quill WYSIWYG Editor Support & Wizard Dual-Mode Input

## Why
Users and agents often need in-report rich-text authoring, formatted notes, and executive drafting directly inside generated HTML reports without bundlers. Furthermore, when configuring deliverables in the interactive HTML Creation Studio (`create.html`), complex dashboard briefs benefit greatly from rich-text styling (bullet lists, emphasis, formatted headings) rather than a cramped plain-text textarea, while still retaining a lightweight simple mode for quick prompts.

## What Changes
- **Quill CDN Addon Registration**: Register Quill.js v2.0 in the core build pipeline (`build-report.mjs` and `domain-model.mjs`), supporting `--quill`, `--wysiwyg`, and auto-detection signatures (`ql-editor`, `id="editor"`, `new Quill`).
- **Section A Addon Option in HTML Wizard**: Add "WYSIWYG Rich Text Editor (Quill)" as a selectable visual component checkbox in `create.html` (and `skills/html-report/assets/create.html`), including preview wireframe mockup representation and starter download inclusion.
- **Dual-Mode (Simple vs Complex) Board Goals Input**: In `create.html` under *"Describe what you want to build"* -> *"Tell what the board needs to show"*, introduce a toggle between:
  - **Simple Mode**: Quick standard `<textarea>` input for straightforward prompts.
  - **Complex Mode**: Embedded Quill CDN rich-text editor with formatting toolbar (headers, bold, italic, lists, code blocks).
- **Bidirectional Sync & Persistence**: Automatically sync content between simple plain-text and complex rich-text modes, persist input across browser refreshes via `localStorage`, and cleanly format the resulting requirements into the synthesized agent prompt (`#prompt-output-box`).

## Capabilities

### New Capabilities
- `quill-editor`: Provides rich-text document editing via Quill v2.0, dual-mode simple/complex goal authoring within the Creation Studio wizard, state synchronization, local persistence, and prompt synthesis.

### Modified Capabilities
- `cdn-addons-expansion`: Extends the build pipeline's modular CDN catalog to recognize Quill v2.0 CDN assets, autodetect editor DOM signatures, and support explicit `--quill` and `--wysiwyg` CLI flags.

## Impact
- **Core Builder**: Updates `skills/html-report/scripts/build-report.mjs` to add Quill to `ADDONS` with CSS/JS tags.
- **Domain Model**: Updates `skills/html-report/scripts/domain-model.mjs` to register Quill in `ADDON_CATALOG`.
- **Creation Studio Wizard**: Updates `create.html` and `skills/html-report/assets/create.html` with Section A checkbox, simulated wireframe mockup, dual-mode simple/complex tab selector, Quill CDN initialization, and prompt generation logic.
- **Testing**: Adds BDD test scenarios verifying Quill CDN injection, CLI flags, wizard DOM elements, dual-mode synchronization, and prompt output.
