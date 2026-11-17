# Design: Integrating `/html-studio` with Backward Compatibility

## Architecture Overview

```
User / Agent Prompt
  ├── "/html-studio" or "/html-studio:cli" ──┐
  └── "/html-create" or "/html-create:cli" ──┼──▶ skill-router.mjs ──▶ canonical skill: "html-studio"
                                             │
HTTP / Browser Requests                      │
  ├── GET /studio, /html-studio ─────────────┼──▶ static.mjs ──▶ packages/studio/assets/create.html
  └── GET /create, /html-create, /create.html┘
```

## Key Integration Decisions

### 1. Skill Directory & Agent Discovery (`.agents/skills/`)
- Rename `skills/html-create/` to `skills/html-studio/`.
- Update `.agents/skills/` symlink: remove `.agents/skills/html-create` and create `.agents/skills/html-studio -> ../../skills/html-studio`.
- In `skills/html-studio/SKILL.md`:
  - Set `name: html-studio` in YAML frontmatter.
  - Document `/html-studio` and `/html-studio:cli` as primary commands, and explicitly note `/html-create` as a supported legacy alias in `description` so agent skill discovery still matches both.

### 2. Skill Router (`skills/html-report/scripts/skill-router.mjs`)
- Update `SKILL_CATALOG` and `SKILL_TAXONOMY_METADATA` key from `'html-create'` to `'html-studio'`.
- In `SKILL_ROUTING_RULES`:
  - Set `skill: 'html-studio'`.
  - Keep `exactTriggers: ['/html-studio', '/html-studio:cli', '@html-studio', '/html-create', '/html-create:cli', '@html-create']`.
- Update `BENCHMARK_PROMPTS` expectations from `'html-create'` to `'html-studio'` while keeping both `/html-studio` and `/html-create` test prompts.

### 3. HTTP Routes & Launchers (`packages/studio/`)
- **`packages/studio/scripts/routes/static.mjs`**:
  - Serve `assets/create.html` on `/studio`, `/html-studio`, `/create`, `/html-create`, and `/create.html`.
  - Update the manifest `referer` check (`isStudio`) to include `/studio` and `/html-studio` alongside `/create` and `/html-create`.
- **`packages/studio/scripts/open-create.mjs` & `open-create.sh`**:
  - Update log copy from `html-create studio` to `html-studio` (or `HTML Studio`), and optionally support opening `/studio` cleanly while keeping `create.html` working in `file://` mode.
- **`packages/studio/scripts/lib/domain/studio-config.mjs` & `domain-model.mjs`**:
  - Update generated prompt line from `Invoked via /html-create` to `Invoked via /html-studio`.

### 4. Sibling Skills, Docs & Tests
- **Sibling `SKILL.md` files** (`html-report`, `html-dashboard`, `html-presentation`, `html-print`, `html-pwa`): update cross-references from `html-create` / `/html-create` to `html-studio` / `/html-studio`.
- **Docs**: update `AGENTS.md`, `TODO.md`, and `docs/codebase-map.md`.
- **Tests**: update assertions in:
  - `packages/studio/tests/modular-skills.test.mjs`
  - `packages/studio/tests/domain-model.test.mjs`
  - `packages/studio/tests/domain-language.bdd.test.mjs`
  - `packages/studio/tests/scaffold-agent.test.mjs`
  - `packages/studio/tests/html-create.bdd.test.mjs`
  - `tests/integration/experience-review-remediations.test.mjs`
  - `tests/e2e/html-create.e2e.test.mjs`
