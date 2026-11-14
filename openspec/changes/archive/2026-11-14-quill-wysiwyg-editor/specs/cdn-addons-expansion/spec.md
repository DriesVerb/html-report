# cdn-addons-expansion Specification Delta

## ADDED Requirements

### Requirement: Quill WYSIWYG CDN Registration and Auto-Detection
The build pipeline MUST support Quill.js v2.0 as an on-demand rich text WYSIWYG editing addon.

#### Scenario: Quill detected via DOM signatures
- **WHEN** a fragment or document contains `class="ql-editor"`, `id="editor"`, `id="quill-editor"`, `data-quill`, or `new Quill(`
- **THEN** `build-report.mjs` injects the Quill v2.0 stylesheet (`https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css`) and JavaScript bundle (`https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js`) into the `<head>` of the built report.

#### Scenario: Quill requested via explicit CLI flags
- **WHEN** `build-report.mjs` is executed with `--quill`, `--wysiwyg`, `--editor`, or `--addons quill`
- **THEN** the Quill stylesheet and script are injected regardless of content signatures.
