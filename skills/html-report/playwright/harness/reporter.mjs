import fs from "node:fs";
import path from "node:path";

/**
 * Diagnostic Reporter
 * Manages terminal console formatting, JSON telemetry export, and screenshot captures.
 */
export class Reporter {
  constructor(options = {}) {
    this.options = options;
    this.results = [];
    this.failures = [];
    this.warnings = [];
    this.remediations = [];
    this.screenshots = [];
    this.reviewPacket = null;
    this.startTime = 0;
    this.durationMs = 0;
  }

  onRunStart({ htmlPath, mode, detectedMode, quick, totalChecks }) {
    this.startTime = performance.now();
    const modeLabel = quick ? "QUICK MODE" : "FULL SUITE";
    const effectiveMode = (mode || detectedMode || "interactive").toLowerCase();

    console.log(`\n=== Verifying HTML Report: ${htmlPath} [${modeLabel}] ===`);
    console.log(
      `Report Mode: ${effectiveMode.toUpperCase()} (mode arg: ${mode || "none"}, detected: ${detectedMode || "auto"})`
    );
  }

  onCheckStart(check, index, total) {
    console.log(`\n[${index}/${total}] Checking ${check.name}...`);
  }

  onCheckComplete(check, result) {
    this.results.push(result);

    if (result.errors && result.errors.length > 0) {
      for (const err of result.errors) {
        this.failures.push(err);
      }
    }

    if (Array.isArray(result.remediations) && result.remediations.length > 0) {
      for (const item of result.remediations) {
        this.remediations.push(item);
      }
    }

    if (result.warnings && result.warnings.length > 0) {
      for (const warn of result.warnings) {
        this.warnings.push(warn);
        if (this.options.strict) {
          this.failures.push(`[STRICT] ${warn}`);
        }
      }
    }

    // Print check success messages or warnings
    if (result.messages && result.messages.length > 0) {
      for (const msg of result.messages) {
        console.log(`  ✓ ${msg}`);
      }
    } else if (result.status === "passed" && result.assertions && result.assertions.length > 0) {
      const summaryMsg = result.assertions.map((a) => a.message || a.rule).join(", ");
      console.log(`  ✓ ${summaryMsg}`);
    } else if (result.status === "skipped") {
      console.log(`  - Skipped: ${result.skipReason || "Not present in report"}`);
    }
  }

  async captureScreenshot(page, name, customDir) {
    try {
      const targetDir = typeof customDir === "string" && customDir.length > 0 ? customDir : "./screenshots";
      const resolvedDir = path.resolve(process.cwd(), targetDir);
      fs.mkdirSync(resolvedDir, { recursive: true });
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
      const filePath = path.join(resolvedDir, `${Date.now()}_${safeName}.png`);
      await page.screenshot({ path: filePath, fullPage: true });
      this.screenshots.push({ name, path: filePath });
      return filePath;
    } catch {
      return null;
    }
  }

  exportJson(targetPath) {
    if (!targetPath) return;
    const resolvedPath = path.resolve(process.cwd(), targetPath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

    const total = this.results.length;
    const failed = this.results.filter((r) => r.status === "failed" || (r.errors && r.errors.length > 0)).length;
    const passed = this.results.filter((r) => r.status === "passed" && (!r.errors || r.errors.length === 0)).length;
    const skipped = this.results.filter((r) => r.status === "skipped").length;
    const warned = this.results.filter((r) => r.status === "warned").length;

    const allStyleguideCompliant = this.results.every((r) => !r.styleguide || r.styleguide.compliant !== false);

    const report = {
      timestamp: new Date().toISOString(),
      durationMs: this.durationMs,
      summary: {
        total,
        passed,
        failed: this.failures.length > 0 ? Math.max(failed, 1) : 0,
        warned,
        skipped,
        compliant: allStyleguideCompliant && this.failures.length === 0
      },
      options: {
        quick: Boolean(this.options.quick),
        timeout: this.options.timeout,
        bail: Boolean(this.options.bail),
        strict: Boolean(this.options.strict),
        suites: this.options.suites || null,
        cdns: this.options.cdns || null
      },
      results: this.results,
      errors: this.failures,
      warnings: this.warnings,
      remediations: this.remediations,
      screenshots: this.screenshots,
      ...(this.reviewPacket ? { reviewPacket: this.reviewPacket } : {})
    };

    fs.writeFileSync(resolvedPath, JSON.stringify(report, null, 2), "utf-8");
  }

  onRunComplete() {
    this.durationMs = performance.now() - this.startTime;
    const totalTimeSeconds = Math.round(this.durationMs / 100) / 10;
    console.log(`\nVerification finished in ${totalTimeSeconds}s.`);

    if (this.failures.length > 0) {
      console.error("\n✗ VERIFICATION FAILED:");
      this.failures.forEach((f) => console.error(`  - ${f}`));
    } else {
      console.log("\n✔ REPORT VERIFICATION PASSED SUCCESSFULLY!\n");
    }

    if (this.options.json) {
      this.exportJson(this.options.json);
    }

    if (typeof this.options.reviewPacket === "string" && this.reviewPacket) {
      const rpPath = path.resolve(process.cwd(), this.options.reviewPacket);
      fs.mkdirSync(path.dirname(rpPath), { recursive: true });
      fs.writeFileSync(rpPath, JSON.stringify({
        ...this.reviewPacket,
        remediations: this.remediations,
        screenshots: this.screenshots,
        errors: this.failures,
        warnings: this.warnings
      }, null, 2), "utf-8");
    }

    return {
      success: this.failures.length === 0,
      failures: this.failures,
      warnings: this.warnings,
      remediations: this.remediations,
      screenshots: this.screenshots,
      reviewPacket: this.reviewPacket,
      results: this.results,
      durationMs: this.durationMs
    };
  }
}
