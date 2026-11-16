# Proposal: Create Mode Workspace-First Section & Direct Workspace File Scoping

> **Domain:** `Studio Pipeline` & `Scaffolding` | **Beneficiary:** `Hybrid` (Human Studio Author + AI Agent) | **Two-Axis Classification:** `Static / Server-Connected` + `Interactive / Reactive` | **Journey Companion:** [index.html](index.html)

## Why

In the Creation Studio ([`create.html`](../../../create.html) / [`skills/html-report/assets/create.html`](../../../skills/html-report/assets/create.html)), two workflow friction points make project setup feel backwards:

1. **Workspace creation is split and buried at the bottom:** The **"Project folder name"** field (`#input-project-slug`) is tucked inside **"Describe what you want to build (Optional)"**, while the **"Create Workspace"** button (`#btn-scaffold-now`) sits at the very end of the wizard in Step 6 (`#step-output`). Users want to name and create their project workspace right after picking *what* they are building, before describing details or attaching source files.
2. **Attached files stage into a generic `projects/_uploads/` folder instead of the project workspace:** Because no workspace exists yet when the user reaches **"Does it need to be built on the basis of other documents, images, or data-sets?"**, `stageBrowserFile()` posts to `POST /api/create/upload` which writes files into a shared generic `projects/_uploads/` directory ([`serve-report.mjs`](../../../skills/html-report/scripts/serve-report.mjs#L2632-L2634)), and files already sitting inside the project's workspace folder (`projects/<slug>/`) are not automatically surfaced in that question.

## What Changes

1. **Dedicated Workspace Section Between "What are you building?" and "Describe what you want to build" (`create.html`, `skills/html-report/assets/create.html`)**
   - Insert a dedicated **Workspace Setup** section (`#workspace-setup-section`) directly between the 4 target cards under **"What are you building? (Deliverable Purpose)"** and **"Describe what you want to build"**.
   - Place **"Project folder name"** (`#input-project-slug`) and, directly next to it, the **"Create Workspace"** button (`#btn-scaffold-now`), accompanied by inline workspace status feedback (`#workspace-lifecycle-status`, result banner with **Open Report**, and error banner).
   - Track the active workspace (`activeWorkspaceSlug`) in studio state so subsequent edits across Steps 1–5 can sync to the same `projects/<slug>/` workspace (**Update Workspace**) rather than spawning duplicate `-2` folders, while Step 6 remains focused on the live AI prompt, **Send to Agent**, and Wireframe Mockup.

2. **Direct Workspace File Staging & Inclusion in "Does it need to be built on the basis of..." (`serve-report.mjs`, `scaffold-project.mjs`, `create.html`)**
   - Update `POST /api/create/upload` to accept `projectSlug` and write uploaded/dropped files directly into `projects/<slug>/refs/<safeName>` (with path confinement) whenever a project workspace is active, instead of a generic `projects/_uploads/` folder.
   - Update `GET /api/create/workspace-files` to accept `?project=<slug>` so files already inside `projects/<slug>/` (including `projects/<slug>/refs/`) are discovered and prioritized first.
   - Automatically include/hydrate files already present in the active workspace (`projects/<slug>/`) inside **"Does it need to be built on the basis of..."** (`#collected-files-list`) when creating or selecting a workspace, and ensure `scaffoldProject()` preserves existing `refs/` files during in-place workspace updates.

## Capabilities

### New Capabilities
- None (extends the existing `studio-fast-assembly` capability).

### Modified Capabilities
- `studio-fast-assembly`: Relocate `"Project folder name"` and `"Create Workspace"` into a new section between `"What are you building?"` and `"Describe what you want to build"`, support in-place config sync for the active workspace, stage uploads directly into `projects/<slug>/refs/` instead of generic `projects/_uploads/`, and include files already present in `projects/<slug>/` in `"Does it need to be built on the basis of..."`.

## Impact

- **Creation Studio UI:**
  - [`skills/html-report/assets/create.html`](../../../skills/html-report/assets/create.html) and root [`create.html`](../../../create.html) (must remain byte-identical)
- **Server & Scaffolding Pipeline:**
  - [`skills/html-report/scripts/serve-report.mjs`](../../../skills/html-report/scripts/serve-report.mjs) (`POST /api/create/upload`, `GET /api/create/workspace-files`, `POST /api/create/scaffold`)
  - [`skills/html-report/scripts/scaffold-project.mjs`](../../../skills/html-report/scripts/scaffold-project.mjs) (`stageReferenceFiles`, `scaffoldProject` in-place update preserving `refs/`)
  - [`skills/html-report/scripts/domain-model.mjs`](../../../skills/html-report/scripts/domain-model.mjs) (prompt generation reflecting `projects/<slug>/refs/...`)
- **Tests:**
  - [`tests/create-reference-files.test.mjs`](../../../tests/create-reference-files.test.mjs)
  - [`tests/studio-fast-assembly.test.mjs`](../../../tests/studio-fast-assembly.test.mjs)
  - [`tests/html-create.bdd.test.mjs`](../../../tests/html-create.bdd.test.mjs)
