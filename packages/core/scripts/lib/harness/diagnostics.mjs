/**
 * Verification error parsing and prescriptive remediation diagnostics
 * for @html-report/core harness.
 */

/**
 * Parses Playwright verification stdout/stderr to extract precise overflow/console diagnostics
 * and synthesizes prescriptive, spoon-fed instructions for smaller models.
 */
export function parseVerificationError(stdout = "", stderr = "") {
  const combined = `${stdout}\n${stderr}`;

  const elemOverflowMatch = combined.match(
    /Breakpoint\s+(\w+)\s+\((\d+)px\)\s+elements without enough space:\s+<([a-zA-Z0-9_-]+)(?:#([a-zA-Z0-9_-]+))?>\s+\((\d+)px\s*>\s*(\d+)px:\s*([^)]*)\)/i
  );

  if (elemOverflowMatch) {
    const bpName = elemOverflowMatch[1];
    const bpWidth = elemOverflowMatch[2];
    const tag = elemOverflowMatch[3];
    const id = elemOverflowMatch[4] || null;
    const scrollWidth = Number(elemOverflowMatch[5]);
    const clientWidth = Number(elemOverflowMatch[6]);
    const selector = id ? `#${id}` : tag;

    const instruction = id
      ? `In your fragment file, find '${selector}'. Wrap this element in <div class="overflow-x-auto w-full"> or change the grid to single-column on mobile with 'grid-cols-1 md:grid-cols-2'. Then re-run the harness command.`
      : `In your fragment file, find <${tag}>. Wrap this element in <div class="overflow-x-auto w-full"> or ensure max-w-full. Then re-run the harness command.`;

    return {
      failureType: "HORIZONTAL_OVERFLOW",
      culprit: {
        selector,
        tag,
        id,
        viewport: `${bpWidth}px (${bpName})`,
        scrollWidth,
        clientWidth
      },
      instruction_for_agent: instruction
    };
  }

  const pageOverflowMatch = combined.match(
    /Breakpoint\s+(\w+)\s+\((\d+)px\)\s+has page horizontal overflow:\s+scrollWidth=(\d+)px\s*>\s*innerWidth=(\d+)px/i
  );

  if (pageOverflowMatch) {
    const bpName = pageOverflowMatch[1];
    const bpWidth = pageOverflowMatch[2];
    const scrollWidth = Number(pageOverflowMatch[3]);
    const innerWidth = Number(pageOverflowMatch[4]);

    return {
      failureType: "PAGE_HORIZONTAL_OVERFLOW",
      culprit: {
        viewport: `${bpWidth}px (${bpName})`,
        scrollWidth,
        innerWidth
      },
      instruction_for_agent: `Page body has horizontal overflow at ${bpWidth}px (${bpName}). Check elements with fixed widths or margin/padding exceeding viewport, and ensure responsive containers use max-w-full.`
    };
  }

  const consoleMatch = combined.match(/Browser console errors\s*\(\d+\):\s*(.*)/i);
  if (consoleMatch) {
    return {
      failureType: "BROWSER_CONSOLE_ERROR",
      culprit: {
        error: consoleMatch[1].trim()
      },
      instruction_for_agent: `A browser runtime exception was thrown: "${consoleMatch[1].trim()}". Fix the client-side JavaScript or syntax in your fragment.`
    };
  }

  const failureLines = [];
  const lines = combined.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") && failureLines.length < 5) {
      failureLines.push(trimmed.slice(2));
    }
  }

  if (failureLines.length > 0) {
    return {
      failureType: "VERIFICATION_ASSERTION_FAILED",
      culprit: {
        failures: failureLines
      },
      instruction_for_agent: `Verification assertion failed: ${failureLines[0]}. Adjust fragment markup to satisfy publication requirements.`
    };
  }

  return {
    failureType: "VERIFICATION_FAILURE",
    culprit: {
      rawOutput: combined.slice(-500).trim()
    },
    instruction_for_agent: "Headless browser verification failed. Inspect the console logs and correct any layout or script errors."
  };
}

/**
 * Formats a prescriptive JSON diagnostic error payload for agents and small models.
 */
export function formatPrescriptiveDiagnostic(lintResult, attempt = 1, maxAttempts = 3) {
  const { issues = [] } = lintResult;
  const primaryIssue = issues[0] || {};
  const isFinal = attempt >= maxAttempts;

  return {
    status: isFinal ? "FAILED" : "REMEDIATION_REQUIRED",
    attempt,
    maxAttempts,
    failureType: "PREFLIGHT_LINT_ERROR",
    issueCount: issues.length,
    issues: issues.map(iss => ({
      type: iss.type,
      line: iss.line,
      tag: iss.tag,
      snippet: iss.snippet,
      instruction: iss.suggestedFix || iss.message
    })),
    instruction_for_agent: isFinal
      ? `Maximum remediation attempts (${maxAttempts}) reached. Halt and inspect errors manually.`
      : (primaryIssue.suggestedFix
          ? `Fix line ${primaryIssue.line}: ${primaryIssue.suggestedFix}. Alternatively run with --auto-fix.`
          : "Resolve the pre-flight linting issues listed in the issues array.")
  };
}

/**
 * Emits a high-contrast terminal remediation banner followed by structured JSON.
 */
export function printRemediationBanner(payload) {
  const isFailed = payload.status === "FAILED";
  const title = isFailed
    ? `✗ FATAL PIPELINE FAILURE: MAXIMUM RETRIES (${payload.maxAttempts}) EXCEEDED`
    : `⚠ REMEDIATION DIRECTIVE FOR AGENT (Attempt ${payload.attempt} of ${payload.maxAttempts})`;

  console.error("\n" + "=".repeat(80));
  console.error(title);
  console.error("-".repeat(80));
  if (payload.instruction_for_agent) {
    console.error(`DIRECTIVE: ${payload.instruction_for_agent}`);
  }
  if (payload.culprit?.selector) {
    console.error(`CULPRIT SELECTOR: ${payload.culprit.selector} (${payload.culprit.viewport || ""})`);
  }
  console.error("=".repeat(80));
  console.error(JSON.stringify(payload, null, 2) + "\n");
}
