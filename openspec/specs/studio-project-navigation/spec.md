# studio-project-navigation Specification

## Purpose
Provides a dedicated, streamlined navbar and an integrated workspace projects directory for the HTML Creation Studio, enabling users to explore, organize, and launch local HTML reports and companion dashboards directly in new tabs with semantic versioning indicators.

## Requirements

### Requirement: Dedicated Streamlined Creation Studio Navbar
The Creation Studio SHALL provide a dedicated top sticky navbar featuring the studio title and mode badge on the left, and a top-level Sections TOC dropdown, a Projects directory action button, and a unified Settings Gear dropdown on the right.

#### Scenario: Dedicated navbar layout rendered
- **WHEN** the user opens the Creation Studio
- **THEN** the navbar renders the title on the left and displays the Sections dropdown, Projects button, and Settings Gear dropdown on the right without loose theme or download buttons

### Requirement: Consolidated Settings Gear Dropdown in Studio
The Creation Studio navbar SHALL encapsulate theme selection swatches, PWA installation controls, and export options (Download Starter HTML, Copy AI Prompt, Print Specification) inside a single `#studio-settings-gear-btn` dropdown menu.

#### Scenario: User accesses settings controls
- **WHEN** the user clicks the Settings Gear button in the Creation Studio navbar
- **THEN** the dropdown displays appearance theme swatches, PWA installation actions, and export choices in organized sections

### Requirement: Interactive Projects Directory Navigation
The Creation Studio SHALL provide a Projects navigation control (`#navbar-projects-btn`) that toggles or navigates to the Projects Directory view (`#view-projects`), allowing users to switch seamlessly between the report creation wizard and local project listings.

#### Scenario: Switching to Projects Directory view
- **WHEN** the user clicks the Projects button in the Creation Studio navbar
- **THEN** the interface transitions to the Projects Directory view and updates the active navigation state

### Requirement: Automated Workspace Projects Discovery Endpoint
When running via the local development server (`serve-report.mjs`), the server SHALL expose a `GET /api/projects` endpoint that scans the workspace for HTML reports, extracts document title, file path, report category, and semantic version metadata, and returns a JSON list.

#### Scenario: Fetching discovered projects via API
- **WHEN** the Creation Studio requests `GET /api/projects` from the development server
- **THEN** the server returns an HTTP 200 response with a JSON payload containing discovered HTML projects with path, title, category, and version details

### Requirement: Projects List Display with Semantic Versioning and New-Tab Launching
The Projects Directory view SHALL display discovered workspace HTML projects with title, location, category badge, and semantic versioning tag, and SHALL provide an Open button on each project card that opens the report in a new browser tab.

#### Scenario: Opening a project from the directory
- **WHEN** the user clicks the Open button on any project card in the Projects Directory
- **THEN** the browser opens the target HTML report in a new tab with `target="_blank"` and `rel="noopener noreferrer"`
