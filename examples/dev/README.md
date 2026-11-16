# Developer Artifacts & Historical Feature Views (`dev/`)

This directory houses development-time HTML fragments, previous feature dashboards, and side-by-side verification runners that have been preserved for reference and testing.

## Contents

- `current-feature.html`: Side-by-side verification runner for the multi-agent tracker and normalized adapter testing.
- `landing-fragment.html`: Showcase landing fragment for root `index.html`.
- `codex-telemetry-fragment.html` & `report-codex-telemetry.html`: OpenAI Codex streaming function call and token telemetry dashboards.
- `offline-cdn-comparison.html` & `offline-cdn-options-fragment.html`: CDN latency and bundle comparison benchmarks.
- `implementation-roadmap.html`: High-level strategic implementation roadmap.

## Dev Server Routing
All files in `dev/` are automatically accessible on `http://localhost:3000/dev/<filename>` and transparently served via root fallback `http://localhost:3000/<filename>` through `skills/html-report/scripts/serve-report.mjs`.
