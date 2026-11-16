import { VerificationCheck } from "../../registry.mjs";

export class ConsoleErrorsCheck extends VerificationCheck {
  constructor() {
    super({
      id: "core:console-errors",
      name: "Console & Network Tile Errors",
      category: "core",
      cliFlags: ["--strict"],
      styleguideRules: ["no-console-errors", "no-uncaught-page-errors", "no-initial-syntax-errors", "no-403-tiles"]
    });
  }

  async run({ page, options, sharedState }) {
    const errors = [];
    const warnings = [];

    // 1. Initial syntax error check on render
    const initialSyntaxError = await page.evaluate(() => {
      const text = document.body ? document.body.innerText || "" : "";
      const hasSyntaxError = /syntax error in text/i.test(text);
      const errorSvg = document.querySelectorAll("svg[aria-roledescription='error'], .error-text").length > 0;
      return hasSyntaxError || errorSvg;
    });
    if (initialSyntaxError) {
      errors.push('Visible "Syntax error in text" detected on initial page render.');
    }

    // 2. Browser console errors
    const consoleErrors = sharedState?.consoleErrors || [];
    if (consoleErrors.length > 0) {
      errors.push(`Browser console errors (${consoleErrors.length}): ${consoleErrors.join(" | ")}`);
    }

    // 3. Uncaught page errors
    const pageErrors = sharedState?.pageErrors || [];
    if (pageErrors.length > 0) {
      errors.push(`Uncaught page errors (${pageErrors.length}): ${pageErrors.join(" | ")}`);
    }

    // 4. Failed tile responses
    const failedTileResponses = sharedState?.failedTileResponses || [];
    if (failedTileResponses.length > 0) {
      errors.push(`Leaflet map had 403 tile responses: ${failedTileResponses.join(" | ")}`);
    }

    // 5. Strict mode console warnings
    const consoleWarnings = sharedState?.consoleWarnings || [];
    if (consoleWarnings.length > 0) {
      warnings.push(`Browser console warnings (${consoleWarnings.length}): ${consoleWarnings.slice(0, 3).join(" | ")}`);
    }

    return {
      id: this.id,
      name: this.name,
      status: errors.length > 0 ? "failed" : warnings.length > 0 ? "warned" : "passed",
      errors,
      warnings,
      messages: errors.length === 0 ? ["0 console errors, 0 page errors, 0 syntax error artifacts."] : []
    };
  }
}
