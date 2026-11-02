---
description: "Mandatory rule: Generate companion index.html journey reports, minimal task tracking, and continuously update localhost:3000 for in-progress features"
always_on: true
---

# OpenSpec Journey & HTML Report Rule

When brainstorming, planning, or using OpenSpec in this repository, always follow these rules:

1. **Companion `index.html` in Feature Folder**:
   - Every change directory under `openspec/changes/<feature-name>/` MUST contain an `index.html`.
   - The report presents the brainstorm, architecture, delta specs, and design visually using the repo's `html-report` skill.
   - Must include prominent relative links back to `./proposal.md`, `./design.md`, `./tasks.md`, and `./specs/`.

2. **Minimal Task Tracking**:
   - During implementation, maintain a minimal, clear task tracking file (`tasks.md`) in the same folder.
   - Connected directly to `index.html` to reflect ongoing execution and verification.

3. **Current State of the Journey**:
   - `index.html` must visually indicate the current journey phase:
     `Brainstorming` -> `Planning` -> `Implementing` -> `Verifying` -> `Shipped`.
   - Show live completion status, remaining tasks, and key milestones.
   - Update `index.html` as tasks in `tasks.md` are completed.

4. **Always Update `localhost:3000` When Feature Is In Progress**:
   - Whenever any feature is actively in progress, **always update `localhost:3000`** in real time!
   - Mirror or sync the in-progress feature report to the server's tracked file (`implementation-progress.html` at root), served by `skills/html-report/scripts/serve-report.mjs --port 3000`.
   - As tasks advance or code changes occur, immediately update the file so the live dev server on `http://localhost:3000` reloads automatically via Server-Sent Events (SSE).
