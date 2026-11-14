# Tasks: Quill WYSIWYG Editor Support & Wizard Dual-Mode Input

## 1. Addon Pipeline Registration

- [x] 1.1 Register Quill v2.0 in `skills/html-report/scripts/build-report.mjs` with CSS/JS CDN tags, signatures (`ql-editor`, `id="editor"`, `new Quill`), and CLI flags (`--quill`, `--wysiwyg`, `--editor`)
- [x] 1.2 Register Quill in `skills/html-report/scripts/domain-model.mjs` under `ADDON_CATALOG` with flag `--quill` and label
- [x] 1.3 Verify pipeline build and CLI detection using a test fragment containing Quill editor signatures

## 2. Wizard Visual & Data Component Addon (Section A)

- [x] 2.1 Add Quill WYSIWYG Editor checkbox (`#chk-quill`) under Section A (Visual & Data Components) in `create.html` and `skills/html-report/assets/create.html`
- [x] 2.2 Wire `#chk-quill` to simulated wireframe mockup (`#mockup-editor-widget`) and prompt output generation
- [x] 2.3 Update `downloadStarterHtml()` in `create.html` to inject Quill CSS and JS bundle when `#chk-quill` is active

## 3. Dual-Mode Simple vs Complex Board Goals in Wizard

- [x] 3.1 Insert Simple vs Complex (Quill) toggle tabs above *"Tell what the board needs to show"* in `create.html` and `skills/html-report/assets/create.html`
- [x] 3.2 Implement Quill v2.0 Snow container initialization with DaisyUI theme styling
- [x] 3.3 Implement bidirectional synchronization between Simple (`#input-board-goals`) and Complex (`#quill-board-goals-editor`)
- [x] 3.4 Implement `localStorage` persistence for active input mode and goal content
- [x] 3.5 Update `updatePromptAndPreview()` to serialize rich Quill goals into clean Markdown lines inside `#prompt-output-box`
- [x] 3.6 Refactor mode toggle buttons to compact Simple/Rich buttons with Simple default (`#btn-mode-simple`, `#btn-mode-complex`)
- [x] 3.7 Implement dedicated Rich Document & Goals Editor modal (`#modal-rich-goals`) with full spacious Quill canvas and live character counter
- [x] 3.8 Implement `saveRichGoalsAndClose()` saving formatted content back into Creation Studio textarea, indicators, and live prompt/preview

## 4. Verification & Documentation

- [x] 4.1 Write automated BDD test in `tests/quill-editor.bdd.test.mjs` validating pipeline injection, CLI flags, wizard DOM structure, and dual-mode synchronization
- [x] 4.2 Run test suite (`node --test tests/quill-editor.bdd.test.mjs`) and verify all assertions pass
- [x] 4.3 Update documentation in `docs/cdn-stack.md` and `skills/html-report/references/architecture-and-styling.md` documenting Quill v2.0 support
- [x] 4.4 Add automated BDD assertions in `tests/quill-editor.bdd.test.mjs` verifying compact Simple/Rich buttons, Rich Editor modal, and bidirectional synchronization
