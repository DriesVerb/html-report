# Tasks: Fragment-Only Skill Reference Guides (70% Context Reduction)

> **Companion Dashboard:** [index.html](index.html) | **Proposal:** [proposal.md](proposal.md) | **Design:** [design.md](design.md) | **Delta Spec:** [fragment-only-skill-references](specs/fragment-only-skill-references/spec.md)

## Phase 1: Prune Shell Boilerplate from `architecture-and-styling.md`

- [x] 1.1 Rewrite `skills/html-report/references/architecture-and-styling.md` into a `<= 120`-line Fragment-Only Agent Cheat Sheet (removing raw `<head>`, `<header class="navbar">`, and `<footer>` markup dumps).
- [x] 1.2 Add copy-pasteable `<main>` component recipes (KPI grid, responsive card header, horizontal stepper, responsive table, and Showdown markdown trigger).

## Phase 2: Automated Reference Size Guard & Verification

- [x] 2.1 Add a test assertion verifying `skills/html-report/references/architecture-and-styling.md` remains `<= 150` lines and free of duplicate navbar/head shell templates.
- [x] 2.2 Update companion [index.html](index.html) and sync `implementation-progress.html` on `localhost:3031`.
