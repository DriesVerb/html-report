# 🧪 Testing, Verification & Native BDD

`html-report` features a dual verification strategy designed to guarantee both functional correctness and responsive visual integrity across viewports, themes, and devices.

---

## 🔬 Zero-Framework Native BDD Harness

To achieve test-driven development directly from OpenSpec specifications without heavy external dependencies (like Cucumber or Jest), `html-report` includes a native BDD micro-framework built directly on Node's native `node:test` and `node:assert/strict`:

- **Location**: `tests/harness/bdd.mjs` & `tests/harness/openspec-bdd.mjs`
- **Zero Dependencies**: Requires zero npm packages; runs natively on Node.js v20+.
- **Language Constructs**: Provides familiar Gherkin semantics: `Feature`, `Scenario`, `Given`, `When`, `Then`, and `And`.

```javascript
import { Feature, Scenario, Given, When, Then } from "./harness/bdd.mjs";
import assert from "node:assert/strict";

Feature("Report Generation Integrity", () => {
  Scenario("Assembling a minimal report fragment", async () => {
    let htmlResult;

    Given("a semantic HTML fragment", () => {
      // Setup fragment
    });

    When("the deterministic compiler builds the report", () => {
      // Call buildReport(...)
    });

    Then("the output should contain DOCTYPE and active Tailwind", () => {
      // Assertions
    });
  });
});
```

### Automatic OpenSpec Scenario Binding

The OpenSpec BDD harness (`tests/harness/openspec-bdd.mjs`) parses `spec.md` files at test time, extracting requirement scenarios (`#### Scenario: <title>`). It automatically binds defined test functions and registers any unmapped scenarios as `test.todo()`, ensuring complete requirement coverage tracking.

---

## 📱 Playwright Multi-Breakpoint Verification

Visual quality cannot be guaranteed by unit tests alone. The verification engine (`skills/html-report/playwright/verify-report.mjs`) automates responsive auditing across all 5 Tailwind CSS breakpoints:

| Viewport | Width | Height | Device Class |
| :--- | :--- | :--- | :--- |
| **Mobile (`sm`)** | 375px | 667px | iPhone SE / Compact Mobile |
| **Tablet (`md`)** | 768px | 1024px | iPad / Tablet Portrait |
| **Desktop (`lg`)** | 1024px | 768px | Standard Laptop |
| **Wide Desktop (`xl`)** | 1280px | 800px | High-DPI Desktop |
| **Ultra-Wide (`2xl`)** | 1536px | 900px | Ultra-Wide Monitor |

### Horizontal Scrollbar ("Insufficient Space") Detection

During headless verification, Playwright executes a layout pass inspecting every container element. If any element has:
$$\text{scrollWidth} > \text{clientWidth}$$
the harness visually flags the element with `[data-insufficient-space="true"]`, captures a diagnostic screenshot, and triggers the `REMEDIATING` state with a prescriptive JSON instruction indicating the offending element ID and recommended CSS fix.

---

## 🛡️ Browser Runtime Integrity & CDN Health

The suite includes headless browser tests (`tests/browser-runtime-integrity.test.mjs`) that:
1. Verify that `index.html` loads with **zero console errors** and **zero unhandled page errors**.
2. Assert that all 16 external CDN globals (`tailwind`, `lucide`, `Alpine`, `Chart`, `mermaid`, `L`, `gridjs`, `katex`, `marked`, `hljs`, `dayjs`, `impress`, `Mock`, `showdown`, `FullCalendar`) initialize cleanly without collisions.
3. Validate Content Security Policy (CSP) and Subresource Integrity (SRI) declarations.

---

## 🏃 Running the Test Suite

```bash
# Run all unit, integration, and BDD tests:
node --test tests/*.test.mjs

# Run a specific BDD suite:
node --test tests/agent-tracker.bdd.test.mjs
```
