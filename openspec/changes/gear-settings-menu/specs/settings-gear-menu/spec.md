## ADDED Requirements

### Requirement: All Settings entry point and tabbed overview

The system SHALL satisfy: The first option inside the gear dropdown menu is an "All Settings" button that opens an overview modal displaying settings categorized underneath dedicated tabs (Appearance, Download & Publishing, AI & Agent Bridge, Page Editor).

#### Scenario: All Settings button verified

- **WHEN** a user opens the gear menu and clicks "All Settings"
- **THEN** the system opens an overview modal showing all settings underneath their respective tabs.

### Requirement: Unexpanded navbar gear menu options

The system SHALL satisfy: All sections inside the gear panel default to an unexpanded (collapsed) state. The unexpanded header of "Appearance" displays both the title and the current active color palette with theme label and swatch dots.

#### Scenario: Unexpanded sections verified

- **WHEN** a user opens the gear menu
- **THEN** all sections are collapsed by default, and the Appearance header displays the current theme name and color palette preview.

### Requirement: Download section with integrated Publish switch

The system SHALL satisfy: The section previously titled "Export" is titled "Download". The first option inside the Download section is a toggle switch for "Publish". Following the switch is "Download as HTML" (which respects the publish state to generate clean output) and other download options.

#### Scenario: Download and publish switch verified

- **WHEN** a user opens the Download section
- **THEN** the first option is a Publish toggle switch followed by "Download as HTML".

### Requirement: Removal of separate publishing section

The system SHALL satisfy: The gear panel does not render a separate standalone "Publishing" section because publishing functionality is unified into the Download section.

#### Scenario: Redundant publishing section eliminated

- **WHEN** a user inspects the gear dropdown or settings registry
- **THEN** no standalone "Publishing" section exists outside the Download section and All Settings modal.
