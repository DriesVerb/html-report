# Project Agent Guide: Headless Bridge Test

- **Project Slug**: `headless-bridge-test`
- **Archetype / Mode**: `report`
- **Theme**: `light`
- **Two-Way Agent Bridge**: `enabled (--ai)`
- **Turnkey AI Bridge Port**: `3031`
- **Turnkey AI Default Model**: `Gemini 3.8 Flash (Low)`
- **Turnkey AI Default Persona**: `analyst`

## Source of Truth & Pipeline

1. **Edit the Semantic Fragment**: [fragment.html](./fragment.html) (`<main id="report-main">`). Do **not** hand-edit `index.html` directly.
2. **Rebuild the Deliverable**:
   ```bash
   node skills/html-report/scripts/build-report.mjs --project headless-bridge-test --content projects/headless-bridge-test/fragment.html --title "Headless Bridge Test" --mode report --theme light --ai --ai-port 3031 --no-ai-dock
   ```
3. **Live Preview & Two-Way Bridge**:
   ```bash
   node skills/html-report/scripts/serve-report.mjs projects/headless-bridge-test/index.html --port 3031
   ```
4. **Machine-Readable Manifest**: See [report.manifest.json](./report.manifest.json) (and the embedded `#agent-manifest` JSON in `index.html`) for deterministic section and widget selectors.

For full authoring conventions, see [agent-authoring-guide.md](../../skills/html-report/references/agent-authoring-guide.md).
