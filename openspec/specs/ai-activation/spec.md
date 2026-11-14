# ai-activation Specification

## Purpose
Defines per-report AI bridge activation controls inside the Settings UI with instant runtime toggle behavior without reload.

## Requirements

### Requirement: Activate AI setting

The system SHALL satisfy: The gear panel offers an Activate AI toggle that persists per board and takes effect without reload.

#### Scenario: Activate AI setting verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** the gear panel offers an Activate AI toggle that persists per board and takes effect without reload.

### Requirement: Single capability source

The system SHALL satisfy: `isAiCapable()` unifies meta flag, setting and legacy triggers, and drives badge and editor behavior.

#### Scenario: Single capability source verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** `isAiCapable()` unifies meta flag, setting and legacy triggers, and drives badge and editor behavior.

### Requirement: Turnkey per board

The system SHALL satisfy: When AI is active but disconnected, a copy-ready prompt specific to this board's source file is shown with retry and auto-recovery.

#### Scenario: Turnkey per board verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** when AI is active but disconnected, a copy-ready prompt specific to this board's source file is shown with retry and auto-recovery.

### Requirement: Build-time flag

The system SHALL satisfy: `--ai` pre-marks a report so shared copies show the turnkey on open.

#### Scenario: Build-time flag verified

- **WHEN** a user opens a generated report and exercises this behavior
- **THEN** `--ai` pre-marks a report so shared copies show the turnkey on open.
