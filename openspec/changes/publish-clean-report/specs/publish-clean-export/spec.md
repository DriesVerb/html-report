## ADDED Requirements

### Requirement: Set as Published Toggle

The system SHALL satisfy: The system SHALL provide a 'Publish' control in the Settings panel allowing authors to mark the report as published.

#### Scenario: Set as Published Toggle verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** the system SHALL provide a 'Publish' control in the Settings panel allowing authors to mark the report as published.

### Requirement: Deterministic Clean Download

The system SHALL satisfy: The system SHALL offer a download action that yields a standalone HTML file completely stripped of the gear icon, the edit prompt editor dock, and all authoring controls.

#### Scenario: Deterministic Clean Download verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** the system SHALL offer a download action that yields a standalone HTML file completely stripped of the gear icon, the edit prompt editor dock, and all authoring controls.

### Requirement: Deterministic Serialization

The system SHALL satisfy: The clean download generation MUST be deterministic, producing identical byte output for identical document content without timestamps or random tokens.

#### Scenario: Deterministic Serialization verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** the clean download generation MUST be deterministic, producing identical byte output for identical document content without timestamps or random tokens.

### Requirement: CLI Published Flag

The system SHALL satisfy: The build pipeline `build-report.mjs` SHALL support a `--published` flag to emit the clean gear-free report directly.

#### Scenario: CLI Published Flag verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** the build pipeline `build-report.mjs` SHALL support a `--published` flag to emit the clean gear-free report directly.

### Requirement: Preservation of Reader Features

The system SHALL satisfy: The published report MUST preserve core viewer capabilities: responsive reading, Table of Contents, interactive charts, Mermaid diagrams, and print styles.

#### Scenario: Preservation of Reader Features verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** the published report MUST preserve core viewer capabilities: responsive reading, Table of Contents, interactive charts, Mermaid diagrams, and print styles.
