# Proposal: Rename `/html-create` to `/html-studio`

## Summary
Rename the canonical skill and slash command `/html-create` (and `/html-create:cli`) to `/html-studio` (and `/html-studio:cli`), aligning the user-facing skill name with `@html-report/studio` and its expanded role as a full project workspace, theme studio, and live-reload hub—while preserving backward-compatible aliases for `/html-create` and `/create`.

## Why Now
1. **Package & UI Alignment:** The workspace package is already `@html-report/studio` (`packages/studio/package.json`), the web UI title is *"HTML Report Creation Studio"* (`packages/studio/assets/create.html`), and `skills/html-create/SKILL.md` already describes itself as `# Interactive Creation Studio & Skill Router`.
2. **Expanded Scope:** Beyond the initial 4-step creation wizard, the Studio now owns workspace project discovery (`GET /api/projects`), project deletion, OKLCH custom theming, live-reload dev serving, and the Two-Way AI Agent Bridge.
3. **Eliminating Split Naming:** Consolidates `html-create` / `create-studio` / `studio` terminology without breaking existing user muscle memory or scripts.

## Scope & Compatibility Strategy
- **In Scope:**
  - Rename `skills/html-create/` → `skills/html-studio/` and update `.agents/skills/html-studio` symlink (replacing `html-create`).
  - Update `skills/html-report/scripts/skill-router.mjs` to route canonically to `'html-studio'`, while keeping `/html-create`, `/html-create:cli`, and `@html-create` as supported exact triggers.
  - Add `/studio` and `/html-studio` routes in `packages/studio/scripts/routes/static.mjs` while keeping `/create`, `/html-create`, and `/create.html` working.
  - Update `packages/studio/scripts/lib/domain/studio-config.mjs`, `packages/studio/scripts/open-create.{mjs,sh}`, `packages/studio/scripts/html-grill.mjs`, sibling `SKILL.md` files, `AGENTS.md`, `docs/codebase-map.md`, and all unit/BDD/E2E tests.
- **Out of Scope (for this phase):**
  - Renaming internal `assets/create.html`, `assets/create-studio/*.js`, or `/api/create/*` endpoints (can remain internal or be aliased separately to avoid unnecessary churn in `sw.js` and PWA caches).
  - Modifying archived OpenSpec changes under `openspec/changes/archive/`.
