# Tasks: Creation Studio Dedicated Navbar & Projects Directory View

## 1. Creation Studio Dedicated Navbar & Consolidated Settings
- [x] 1.1 Redesign the Creation Studio header in `skills/html-report/assets/create.html` with a dedicated layout matching `template-shell.html` standards, keeping Sections TOC top-level and verifying responsive layout.
- [x] 1.2 Implement the unified Settings Gear dropdown (`#studio-settings-gear-btn`) consolidating theme selection swatches, PWA install action, and export options, and verify all sub-actions trigger cleanly.
- [x] 1.3 Add the top-level Projects navigation button (`#navbar-projects-btn`) with icon and badge in the studio navbar, and verify click toggling.

## 2. Workspace Project Discovery API (`serve-report.mjs`)
- [x] 2.1 Implement the `GET /api/projects` endpoint in `skills/html-report/scripts/serve-report.mjs` to scan workspace directories (`openspec/changes/*/index.html`, `benchmark/`, `dev/`, `research/`, `reports/`) up to 4 levels deep.
- [x] 2.2 Add semantic versioning extraction logic (parsing `<!-- {{VERSION}} -->`, metadata comments, and `package.json`) and category tagging for discovered projects, and verify JSON response format via test script.
- [x] 2.3 Implement offline zero-node fallback in `create.html` for `file://` mode reading cached or bundled showcase reports when the API is unreachable.

## 3. Projects Directory View (`#view-projects`)
- [x] 3.1 Build the responsive Projects Directory grid layout in `create.html` with search filter, category filters, and return-to-wizard navigation.
- [x] 3.2 Implement project cards rendering title, location, category badge, SemVer tag, and an Open button with `target="_blank"`, verifying new tab launch.
- [x] 3.3 Add URL hash routing (`#projects`) to allow direct bookmarking and navigation between the creation wizard and projects list.

## 4. Verification & Journey Sync
- [x] 4.1 Sync `skills/html-report/assets/create.html` with workspace root `create.html` and verify both render identically.
- [x] 4.2 Write automated integration tests in `tests/studio-navbar-projects.test.mjs` verifying navbar elements, project discovery endpoint, and view switching.
- [x] 4.3 Update `skills/html-create/SKILL.md` documenting the dedicated navbar and Projects Directory capabilities.
- [x] 4.4 Update `openspec/changes/studio-navbar-projects-view/index.html` journey dashboard and synchronize with `implementation-progress.html` on `localhost:3000`.
- [x] 4.5 Add mock operations dashboard in `projects/mock-dashboard/index.html` categorized as `Workspace Project` with telemetry metrics and OKLCH charts.
- [x] 4.6 Implement navbar Projects dropdown menu (`#navbar-projects-dropdown`) with quick launcher, real-time search, and instant view-switch scroll restoration.
