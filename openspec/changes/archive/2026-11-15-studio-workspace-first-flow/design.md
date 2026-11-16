# Design: Create Mode Workspace-First Section & Direct Workspace File Scoping

> **Companion Plan:** [index.html](index.html) | **Proposal:** [proposal.md](proposal.md) | **Delta Spec:** [specs/studio-fast-assembly/spec.md](specs/studio-fast-assembly/spec.md)

## Context & Current State

Today in [`skills/html-report/assets/create.html`](../../../skills/html-report/assets/create.html):
- Lines 345–421 render the 4 target cards under **"What are you building? (Deliverable Purpose)"** (`#step-purpose`).
- Lines 424–509 render **"Describe what you want to build (Optional)"**, which currently mixes `#input-board-goals`, `#input-project-slug` (`"Project folder name"`), `#input-board-audience`, and the reference file section (`"Does it need to be built on the basis of other documents, images, or data-sets?"`).
- Line 1085 places `#btn-scaffold-now` (**"Create Workspace"**) inside Step 6 (`#step-output`), after all 5 configuration steps.
- `stageBrowserFile()` (line 1647) calls `POST /api/create/upload` without any project context; [`serve-report.mjs`](../../../skills/html-report/scripts/serve-report.mjs#L2633) hardcodes `path.join(workspaceRoot, "projects", "_uploads")`.
- `loadWorkspaceFiles()` (line 1698) calls `GET /api/create/workspace-files` which walks the entire repo root up to depth 6, giving no special priority or auto-inclusion to files already inside `projects/<slug>/`.

## Goals & Non-Goals

- **Goals:**
  1. Give users an immediate, intuitive workspace creation step right after choosing *what* they are building (`Report`, `Printable PDF / Doc`, `Live Dashboard`, `Slide Deck Presentation`) and before describing the details.
  2. Put **"Project folder name"** and the **"Create Workspace"** button side-by-side in that new section.
  3. Scope **"Does it need to be built on the basis of..."** directly to that project workspace (`projects/<slug>/` and `projects/<slug>/refs/`), both for newly uploaded files and for files already residing in that workspace.
  4. Keep `create.html` and `skills/html-report/assets/create.html` byte-identical and preserve zero-Node / `file:///` offline fallback behavior.
- **Non-Goals:**
  - Removing `projects/_uploads/` support completely for callers that explicitly omit a workspace (though active studio flows should target `projects/<slug>/refs/` instead of generic `_uploads`).
  - Changing the 6-step numbering of downstream steps (`2` Runtime, `3` Features, `4` AI, `5` Theme, `6` Final Prompt).

## Architectural Design

### 1. Step 1 Layout Reorganization (`create.html`)

Inside `#step-purpose`, separate the flow into three distinct visual blocks:

1. **Block A — What are you building? (Deliverable Purpose)** (`lines 345–421`, unchanged 4 target cards).
2. **Block B — New Workspace Section (`#workspace-setup-section`)**:
   - Positioned immediately below the 4 target cards and immediately above `"Describe what you want to build"`.
   - Styled as a clean bordered card (`p-3.5 bg-base-200/40 rounded-xl border border-base-300/70 space-y-2.5`).
   - Header: `Project Workspace` with live status badge (`#workspace-state-badge`).
   - Primary control row (`flex flex-col sm:flex-row sm:items-end gap-2.5`):
     - Left (`flex-1`): `<label for="input-project-slug">Project folder name</label>` + `<input type="text" id="input-project-slug" ... />`
     - Right (`shrink-0`): `<button id="btn-scaffold-now" type="button" onclick="scaffoldProjectNow(this)" class="btn btn-secondary btn-sm gap-1.5 ...">Create Workspace</button>`
   - Inline feedback strip directly below: `#workspace-lifecycle-status` (`projects/<slug>/` path pill), `#scaffold-result-banner` (with `Open Report` link), and `#scaffold-error-banner`.
3. **Block C — Describe what you want to build (Optional)** (`#describe-build-section`):
   - Retains `#input-board-goals` (Simple/Rich Quill toggle), `#input-board-audience`, and **"Does it need to be built on the basis of other documents, images, or data-sets?"**.
   - Removes `#input-project-slug` from inside Block C so it exists uniquely in Block B.

Step 6 (`#step-output`) keeps:
- Final AI Prompt (`#prompt-output-box`), Copy / Save `.md`, **Send to Agent** (`#btn-send-to-agent`), Live Wireframe Mockup, and a compact synced workspace status summary (with an **Update Workspace** button when `activeWorkspaceSlug` exists and subsequent edits need syncing, or a scroll/jump link back to `#workspace-setup-section` if not yet created).

### 2. Workspace-First Lifecycle & In-Place Config Sync

```
[Pick Deliverable] -> [Enter Project folder name + Click Create Workspace]
                                |
                                v
                  POST /api/create/scaffold
             (creates projects/<slug>/ + refs/)
                                |
          +---------------------+---------------------+
          |                                           |
          v                                           v
 [Upload / Drop Files]                    [Load Existing Workspace Files]
 POST /api/create/upload                  GET /api/create/workspace-files?project=<slug>
   (saves to projects/<slug>/refs/)         (auto-includes files already in projects/<slug>/)
          |                                           |
          +---------------------+---------------------+
                                |
                                v
          [Configure Steps 2-5 -> Update Workspace / Send to Agent]
```

- **Studio State (`activeWorkspaceSlug` & `workspaceDirty`):**
  - When `scaffoldProjectNow()` succeeds, `activeWorkspaceSlug = data.slug`, `#input-project-slug` is populated with `data.slug` (if it was blank/auto-derived), and `workspaceDirty = false`.
  - Any subsequent edit to `#input-board-goals`, `#input-board-audience`, target, mode, addons, widgets, theme, AI config, or `collectedFiles` marks `workspaceDirty = true` and shows an **"Update Workspace"** button/action next to **Create Workspace** (and in Step 6) rather than creating a second `slug-2` folder.
  - When `scaffoldProjectNow()` runs with `updateExisting: true` (or user edits `#input-project-slug` to a *different* folder name, which resets `activeWorkspaceSlug = null` for a fresh workspace), `POST /api/create/scaffold` updates `projects/<slug>/report.manifest.json`, `fragment.html` (if still uncustomized starter or explicitly requested), `index.html`, and `AGENTS.md` **while preserving all existing files in `projects/<slug>/refs/`**.

### 3. Direct Workspace Uploads & Existing Workspace File Discovery

#### A. `POST /api/create/upload` (`serve-report.mjs`)
- Accept optional `projectSlug` (and optional `autoCreateWorkspace` flag) in the JSON body alongside `{ name, contentBase64, sizeBytes }`.
- **Target resolution:**
  - If `projectSlug` is non-empty after `slugifyProject(projectSlug)`:
    - Target directory is `path.join(workspaceRoot, "projects", safeSlug, "refs")`.
    - Validate `isPathInside(projectsRoot, targetDir)` and `isPathInside(targetDir, destPath)` to block traversal.
    - If `projects/<safeSlug>/` does not yet exist on disk and `createWorkspaceIfMissing !== false`, create `projects/<safeSlug>/refs/` (or scaffold if needed) — wait: for predictable UX, if `projects/<safeSlug>/` already exists (created via **Create Workspace**), write directly to `projects/<safeSlug>/refs/<safeName>` and return `{ ok: true, name: safeName, path: "projects/<safeSlug>/refs/<safeName>", scope: "workspace", projectSlug: safeSlug, sizeBytes }`.
    - Also, if `projects/<safeSlug>/report.manifest.json` exists, append/update the entry in `referenceFiles` so the manifest stays in sync with `refs/`.
  - If no `projectSlug` is active (user dropped a file before clicking **Create Workspace** and left `#input-project-slug` blank):
    - If `#input-project-slug` has a typed slug, pass that `projectSlug` or prompt/stage cleanly; if truly un-named, fall back to `projects/_uploads/<safeName>` with a UI badge `"pre-workspace staging"` and migrate into `projects/<slug>/refs/` as soon as **Create Workspace** is clicked.
    - Note for existing test compatibility: `tests/create-reference-files.test.mjs` directly `POST`s `{ name, contentBase64 }` without `projectSlug` and asserts `projects/_uploads/evil-payload.csv`; keeping `projects/_uploads/` as the no-slug fallback preserves API backward compatibility while making **every workspace-active upload** go straight to `projects/<slug>/refs/`.

#### B. `GET /api/create/workspace-files` (`serve-report.mjs`)
- Accept optional `?project=<slug>` query parameter (validated via `slugifyProject`).
- When `project` is supplied and `projects/<slug>/` exists:
  - Collect all non-system files inside `projects/<slug>/` (specifically `projects/<slug>/refs/**` and any custom data/doc/image files inside `projects/<slug>/`, excluding generated boilerplate `index.html`, `fragment.html`, `report.manifest.json`, `AGENTS.md`, `sw.js`, `manifest.webmanifest`) tagged with `inProjectWorkspace: true`.
  - Exclude `projects/_uploads/` from general workspace results unless explicitly requested, or sort `inProjectWorkspace: true` entries to the top.
  - Return `{ ok: true, project: safeSlug, projectFiles: [...], files: [...] }`.

#### C. Auto-Including Workspace Files in `create.html`
- Update `stageBrowserFile(browserFile, collectedId)`:
  - Resolve `const targetSlug = activeWorkspaceSlug || slugifyClient(document.getElementById("input-project-slug")?.value || "")`.
  - Send `projectSlug: targetSlug` in `POST /api/create/upload` whenever `targetSlug` is non-empty (or if `activeWorkspaceSlug` exists).
  - Display a clear workspace badge (`workspace` / `projects/<slug>/refs/...`) in `#collected-files-list`.
- Add `syncProjectWorkspaceFiles(slug)`:
  - Called automatically right after **Create Workspace** succeeds (and when the user blurs/confirms `#input-project-slug` matching an existing project directory, or opens `"From Workspace"`).
  - Fetches `GET /api/create/workspace-files?project=${encodeURIComponent(slug)}`.
  - Merges any `projectFiles` already in `projects/<slug>/` into `collectedFiles` (deduplicating by `path` or `name`) with `uploadStatus: "workspace"`, updating `#collected-files-list`, `#collected-files-count`, and the synthesized AI prompt (`#prompt-output-box`).
- Update `scaffoldProjectNow()` in `create.html`:
  - After scaffolding succeeds, refresh `syncProjectWorkspaceFiles(data.slug)` and update any previously-local/staged entries in `collectedFiles` to their new `projects/<slug>/refs/<name>` paths so the live prompt immediately reflects the workspace paths rather than `projects/_uploads/`.

## Risks & Trade-offs

- **Re-running `Create Workspace` vs. preserving user edits in `fragment.html`:** If a user creates a workspace early, edits `fragment.html` manually or via an agent, and then tweaks a theme or adds a reference file in `create.html`, overwriting `fragment.html` blindly would destroy their edits. Therefore, in-place updates (`updateExisting: true`) must only update `report.manifest.json`, `refs/`, and rebuild `index.html` (via `buildReport()`) unless the user explicitly chooses to regenerate the starter fragment or `fragment.html` is still untouched.
- **Test Compatibility:** `tests/create-reference-files.test.mjs` and `tests/html-create.bdd.test.mjs` inspect DOM selectors (`#input-project-slug`, `#btn-scaffold-now`, `#collected-files-list`, `#workspace-files-picker`). Preserving existing element IDs while relocating `#input-project-slug` and `#btn-scaffold-now` into `#workspace-setup-section` minimizes breakage and keeps `domain-model.mjs` / `scaffold-project.mjs` contracts clean.
