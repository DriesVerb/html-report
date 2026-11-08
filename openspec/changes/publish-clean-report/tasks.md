# Tasks: Publish Mode & Deterministic Clean Download

## 1. Sanitizer & Deterministic Serializer

- [x] 1.1 Implement `HTMLReportPublisher.stripAuthoringElements(docClone)` in `report-runtime.js` targeting `#settings-dropdown`, `#edit-dock`, and draft queue scripts
- [x] 1.2 Ensure deterministic output (normalize attributes, strip non-deterministic session IDs/timestamps, sorted element serialization)
- [x] 1.3 Add `--published` flag to `skills/html-report/scripts/build-report.mjs` for pipeline parity

## 2. Settings UI Integration

- [x] 2.1 Add 'Publishing & Release' subsection in Settings panel with 'Mark as Published' toggle and 'Download Clean (Published) HTML' action
- [x] 2.2 Wire active state indicators (subtle Published badge when publication mode is toggled)

## 3. Verification & Journey

- [x] 3.1 Unit & snapshot tests verifying downloaded HTML has zero `#settings-gear-btn`, zero `#edit-dock`, and identical SHA-256 hashes on repeat exports
- [x] 3.2 Verify TOC, charts, and print styles remain fully functional in published exports
- [x] 3.3 Sync `index.html` and update `implementation-progress.html` on `localhost:3000`
