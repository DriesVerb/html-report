# Repository Rules & Guidelines

## OpenSpec Journey & HTML Report Rule

Whenever we brainstorm, plan, or use **OpenSpec** in this repository, agents and developers must adhere to the following mandatory workflow:

### 1. Feature Companion `index.html`
* For every feature or change in `openspec/changes/<feature-name>/`, always create and maintain a companion **`index.html`** in that exact folder (`openspec/changes/<feature-name>/index.html`).
* The `index.html` is built using the repository's publication-grade `html-report` standard (responsive DaisyUI theme switcher defaulting to `light`, sticky navbar, Tailwind CSS, Lucide icons, Mermaid diagrams, and Chart.js stats).
* **Brainstorm & Plan Presentation**:
  * Visually and interactively presents the brainstorm, problem context, architectural design, requirements, and alternatives.
  * Embeds interactive Mermaid diagrams for technical flows and architecture.
* **Direct Backlinks**:
  * Must contain clear, prominent direct backlinks to the underlying markdown artifacts:
    * `proposal.md` (Brainstorm & Vision)
    * `design.md` (Technical Architecture)
    * `tasks.md` (Task Tracking)
    * `specs/` (Capability Delta Specifications)

### 2. Minimal Task Tracking File (`tasks.md`)
* When transitioning into or conducting implementation, always create and maintain a minimal, focused task tracking file: `openspec/changes/<feature-name>/tasks.md`.
* Keep tasks organized in concise, verifiable numbered phases with checkbox syntax (`- [ ]`, `- [x]`).
* Keep it minimal and focused on actionable milestones without unnecessary filler.

### 3. Living Journey State Dashboard & Live Dev Server (`localhost:3000`)
* The `index.html` acts as the single pane of glass showing the **current state of our journey**:
  * **Journey Phase Stepper**: Clearly highlights the active stage:
    1. `Brainstorming` (exploring problem, concepts, user needs)
    2. `Planning` (designing architecture, delta specs, acceptance criteria)
    3. `Implementing` (active coding against `tasks.md`)
    4. `Verifying` (running test suites and validation)
    5. `Shipped / Archived` (feature complete and merged)
  * **Live Progress Metrics**: Displays task completion percentages and status counts (Total, In Progress, Completed, Remaining).
  * **Connected Task Checklist**: An interactive or formatted task progress section matching `tasks.md`.
* **Continuous Updates to `localhost:3000`**:
  * **MANDATORY**: Whenever a feature is in progress, **always update `localhost:3000`**!
  * Ensure the active feature's `index.html` is mirrored or linked to the active dev server file (e.g., `implementation-progress.html` at workspace root) served on `http://localhost:3000` via `skills/html-report/scripts/serve-report.mjs`.
  * As code is written, tests pass, and checklist items in `tasks.md` are marked complete, immediately update the report file so `localhost:3000` automatically live-reloads and reflects the live journey state.

---

### Generation & Serving Workflow
To generate or update the `index.html`:
```bash
node skills/html-report/scripts/build-report.mjs \
  --title "<Feature Name> - Journey & Plan" \
  --content <path-to-content-fragment.html> \
  --output openspec/changes/<feature-name>/index.html

# Sync with the active dev server file:
cp openspec/changes/<feature-name>/index.html implementation-progress.html
```

To serve on `http://localhost:3000`:
```bash
node skills/html-report/scripts/serve-report.mjs implementation-progress.html --port 3000
```

