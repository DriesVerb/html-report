# Tasks: Create Mode Workspace-First Section & Direct Workspace File Scoping

> **Companion Dashboard:** [index.html](index.html) | **Proposal:** [proposal.md](proposal.md) | **Design:** [design.md](design.md) | **Delta Spec:** [specs/studio-fast-assembly/spec.md](specs/studio-fast-assembly/spec.md)

## Phase 1: Creation Studio Workspace Section & State (`create.html`)

- [x] 1.1 Create `#workspace-setup-section` in `skills/html-report/assets/create.html` directly between the 4 target cards under `"What are you building? (Deliverable Purpose)"` and `"Describe what you want to build"`, containing `#input-project-slug` (`"Project folder name"`) and `#btn-scaffold-now` (`"Create Workspace"`) side-by-side (`sm:flex-row`) plus inline `#workspace-lifecycle-status` / result / error feedback.
- [x] 1.2 Add `activeWorkspaceSlug` and `workspaceDirty` tracking in `create.html` so creating the workspace early enables in-place **"Update Workspace"** syncing across Steps 2–5 without creating duplicate `-2` folders, and update Step 6 (`#step-output`) to show synchronized workspace status.
- [x] 1.3 Synchronize root `create.html` identically with `skills/html-report/assets/create.html`.

## Phase 2: Workspace-Scoped Uploads & Existing-File Inclusion (`serve-report.mjs`, `scaffold-project.mjs`, `create.html`)

- [x] 2.1 Update `POST /api/create/upload` in `skills/html-report/scripts/serve-report.mjs` to accept `projectSlug`, validate path confinement inside `projects/<slug>/refs/`, write uploaded files directly into `projects/<slug>/refs/<safeName>` (rather than `projects/_uploads/`), and sync `report.manifest.json` `referenceFiles` when present.
- [x] 2.2 Update `GET /api/create/workspace-files` in `skills/html-report/scripts/serve-report.mjs` to accept `?project=<slug>` and return `projectFiles` already inside `projects/<slug>/` (prioritizing `refs/` and excluding generated boilerplate), and update `POST /api/create/scaffold` + `scaffoldProject()` in `scaffold-project.mjs` to support safe in-place updates (`updateExisting: true`) preserving existing `refs/`.
- [x] 2.3 Update `create.html` (`stageBrowserFile`, `loadWorkspaceFiles`, `syncProjectWorkspaceFiles`, `scaffoldProjectNow`) so `"Does it need to be built on the basis of..."` uploads into `projects/<slug>/refs/`, automatically includes files already present in `projects/<slug>/`, and updates `collectedFiles` paths + the live AI prompt to `projects/<slug>/refs/...`.

## Phase 3: Verification & Test Coverage

- [x] 3.1 Update `tests/create-reference-files.test.mjs`, `tests/studio-fast-assembly.test.mjs`, and `tests/html-create.bdd.test.mjs` to cover the new DOM section order (`#step-purpose` cards -> `#workspace-setup-section` -> `"Describe what you want to build"`), direct `projects/<slug>/refs/` uploads, auto-inclusion of existing workspace files, in-place workspace updates, and byte-identical `create.html` sync.
- [x] 3.2 Run `node --test tests/create-reference-files.test.mjs tests/studio-fast-assembly.test.mjs tests/html-create.bdd.test.mjs tests/studio-navbar-projects.test.mjs tests/domain-code-alignment.test.mjs` and verify `create.html` with `verify-report.mjs`.
