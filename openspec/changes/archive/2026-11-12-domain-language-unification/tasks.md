# Tasks: Ubiquitous Domain Language & Feature Alignment Architecture

## 1. User-Grounded Domain Modeling & Normalization
- [x] 1.1 Separate Assembly (the fast, reliable mechanical join) from Pipeline (the state machine orchestrator around assembly).
- [x] 1.2 Formalize Create Mode (guided intent), Edit Mode (in-flight draft adjustments), and Published Document (clean final product).
- [x] 1.3 Update proposal (`proposal.md`) and technical architecture (`design.md`) reflecting the refined mental model.

## 2. Feature Alignment Specification & Rubric
- [x] 2.1 Formalize the 5-Step Feature Alignment Rubric in OpenSpec delta specification (`specs/domain-language-model/spec.md`).
- [x] 2.2 Design standardized feature proposal prompt template and archetype matrix in `domain-model.mjs`.

## 3. Interactive Domain Report & Alignment Workbench
- [x] 3.1 Synthesize semantic fragment (`fragment.html`) with user-grounded architecture flow, glossary, and workbench.
- [x] 3.2 Wire Mermaid diagrams with zoom/enlarge modals (`[⤢ Enlarge]`) and Showdown markdown modal viewers for all artifact links.
- [x] 3.3 Compile standalone publication-grade companion report (`index.html`) using `build-report.mjs`.

## 4. Live Server Mirror & Verification
- [x] 4.1 Synchronize `openspec/changes/domain-language-unification/index.html` to `implementation-progress.html` on port 3000.
- [x] 4.2 Verify stepper formatting standard (`w-full overflow-x-auto min-w-[500px]`), markdown links, and responsive layouts across viewports.
- [x] 4.3 Run automated unit and BDD test suites (`domain-model.test.mjs`, `domain-language.bdd.test.mjs`) ensuring zero regressions.
