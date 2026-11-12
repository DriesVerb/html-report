# domain-language-model Specification

## Purpose
Establishes a unified, user-grounded Ubiquitous Domain Language and Feature Alignment Framework across Assembly, Pipeline, Delivery Archetypes, Create Mode, Edit Mode, Published Documents, and the OpenSpec Journey, with explicit Beneficiary (User vs. Agent) and Two-Axis runtime classification.

## ADDED Requirements

### Requirement: Feature Beneficiary Classification
Every proposed feature MUST declare its primary beneficiary: User-Facing, Agent-Facing, or Hybrid.

#### Scenario: Classifying a User-Facing feature
- **GIVEN** a proposal for a visual OKLCH color wheel in the Studio
- **WHEN** evaluated against the beneficiary rubric
- **THEN** it is classified as `User-Facing`
- **AND** evaluated on visual UX, responsiveness, and zero-coding accessibility.

#### Scenario: Classifying an Agent-Facing feature
- **GIVEN** a proposal for a headless `--strict-ids` CLI validation flag
- **WHEN** evaluated against the beneficiary rubric
- **THEN** it is classified as `Agent-Facing`
- **AND** evaluated on non-interactive stdout/stderr, token efficiency, and deterministic exit codes.

### Requirement: Two-Axis Runtime Classification
The system MUST decouple the Serving Mode (how it is hosted) from the Behavioral Mode (how it acts).

#### Scenario: Static File with Client-Side API Fetching
- **GIVEN** a document opened via `file:///` that fetches Pokémon or Weather data
- **WHEN** classified under the two-axis model
- **THEN** its Serving Mode is `Static File`
- **AND** its Behavioral Mode is `Interactive / Reactive`
- **AND** it executes without requiring a local dev server process.

#### Scenario: Server-Connected Real-Time Cockpit
- **GIVEN** a document connected to `localhost:3000` receiving SSE fragment morphs
- **WHEN** classified under the two-axis model
- **THEN** its Serving Mode is `Server-Connected`
- **AND** its Behavioral Mode is `Interactive / Reactive`
- **AND** Datastar SSE hypermedia streaming is active.

### Requirement: Assembly vs. Pipeline Separation
The system MUST maintain Assembly as the fast (<100ms) mechanical join and Pipeline as the state machine orchestrating pre-flight repairs, addon detection, and caching.

#### Scenario: Mechanical Assembly Invariant
- **GIVEN** a semantic fragment and template shell
- **WHEN** assembly executes
- **THEN** the join completes in <100ms with zero token waste.

### Requirement: Draft vs. Published Document Lifecycle
The system MUST support Edit Mode for in-flight adjustments and Published Mode for clean end-product export.

#### Scenario: Pruning Authoring Chrome upon Publish
- **GIVEN** a draft document with active edit dock
- **WHEN** built or exported with `--published`
- **THEN** authoring chrome is pruned while theme switcher and downloads remain intact.
