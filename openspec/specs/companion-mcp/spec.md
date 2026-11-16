# companion-mcp Specification

## Purpose

Provides a minimal, localhost-secured Streamable HTTP Model Context Protocol endpoint on the live report dev server so external AI coding agents can inspect served report state, update fragments and themes in-place, and assemble Semantic Fragments cleanly without a separate daemon.

## Requirements

### Requirement: Streamable HTTP MCP Endpoint

The report dev server SHALL expose a Streamable HTTP MCP endpoint at `/mcp` that accepts JSON-RPC 2.0 requests (`initialize`, `ping`, `tools/list`, `tools/call`), JSON-RPC batches, and notifications while preserving legacy `/mcp/sse` and `/mcp/messages` routes.

#### Scenario: Modern MCP client initializes and lists tools over POST /mcp
- **WHEN** an MCP client sends JSON-RPC `initialize` or `tools/list` via `POST /mcp`
- **THEN** the server responds with HTTP `200`, `Content-Type: application/json`, and the JSON-RPC 2.0 result payload containing server capabilities or the registered tools.

#### Scenario: JSON-RPC notification returns 202 Accepted
- **WHEN** an MCP client sends a JSON-RPC notification without an `id` field (such as `notifications/initialized`) to `POST /mcp`
- **THEN** the server acknowledges the notification with HTTP `202 Accepted` and an empty response body.

### Requirement: Localhost Security Guardrails on `/mcp`

The `/mcp` endpoint SHALL restrict access to loopback connections with `localhost`, `127.0.0.1`, or `[::1]` `Host` headers, SHALL reject browser cross-origin requests with HTTP `403`, and SHALL permit native non-browser MCP clients that omit an `Origin` header.

#### Scenario: Native MCP client without Origin header succeeds on localhost
- **WHEN** a local MCP client sends `POST /mcp` from a loopback address with `Host: localhost:3031` and no `Origin` header
- **THEN** the server processes the JSON-RPC request normally without requiring a CSRF token or returning `Access-Control-Allow-Origin: *`.

#### Scenario: Untrusted browser cross-origin request is rejected
- **WHEN** a request to `POST /mcp` carries an `Origin` header from a non-local origin (such as `https://evil.example`)
- **THEN** the server rejects the request with HTTP `403 Forbidden`.

### Requirement: Live Report State Inspection and Universal DOM Propagation

`report_get_state` SHALL report live metadata of the served Output Deliverable (title, theme, mode, Target Element IDs, Semantic Fragment path, and active browser listener counts), and `report_update_fragment`, `report_set_theme`, and `report_append_alert` SHALL propagate updates to all connected report tabs regardless of whether Datastar streams are wired.

#### Scenario: Inspecting state of a served report returns real document metadata
- **WHEN** an agent invokes `report_get_state` against a served report containing `<section>` and heading `id` attributes
- **THEN** the response includes the document title, active theme, mode, sibling Semantic Fragment path (if present), extracted Target Element IDs, and live listener counts.

#### Scenario: Fragment, theme, and alert updates reach standard live-reloaded tabs
- **WHEN** an agent invokes `report_update_fragment`, `report_set_theme`, or `report_append_alert` while a browser tab is connected to the live-reload stream
- **THEN** the connected tab morphs the Target Element, applies the DaisyUI theme, or renders a dismissible alert toast in place without a full page reload.

### Requirement: Single-Call Semantic Fragment Assembly Tool

The MCP server SHALL expose `report_build` using canonical domain terminology to validate and assemble a Semantic Fragment into an Output Deliverable inside the active workspace root, rejecting paths outside the workspace and triggering live hot-swap on connected tabs.

#### Scenario: Building a valid Semantic Fragment via report_build
- **WHEN** an agent invokes `report_build` with `fragmentHtml`, `title`, and a workspace-relative `outputPath`
- **THEN** the server lints and compiles the Output Deliverable in `<100ms`, broadcasts a live reload to connected tabs, and returns structured diagnostics including `outputPath`, `detectedAddons`, and `warnings`.

#### Scenario: Rejecting outputPath traversal outside workspace root
- **WHEN** an agent invokes `report_build` with an `outputPath` resolving outside the workspace root (such as `../outside.html`)
- **THEN** the tool returns an error result without writing any file to disk.
