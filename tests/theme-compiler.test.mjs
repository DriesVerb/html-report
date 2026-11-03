import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  srgbToLinear,
  linearToSrgb,
  hexToRgb,
  hslToRgb,
  parseColor,
  rgbToOklch,
  autoContrastContent,
  compileTheme,
  compileThemeFile,
  tailwindConfigSnippet,
  DAISYUI_BASE_THEMES
} from "../skills/html-report/scripts/theme-compiler.mjs";

describe("Phase 1: Pure JS OKLCH Engine & DaisyUI Compiler", () => {
  describe("Color math & format conversions", () => {
    it("should accurately convert sRGB channels to linear sRGB and back", () => {
      const sampleValues = [0, 10, 64, 128, 200, 255];
      for (const val of sampleValues) {
        const linear = srgbToLinear(val);
        const srgbBack = linearToSrgb(linear);
        assert.equal(srgbBack, val, `Roundtrip sRGB failed for channel ${val}`);
      }
    });

    it("should parse 3-digit, 6-digit, and 8-digit hex colors accurately", () => {
      const [r1, g1, b1, a1] = hexToRgb("#f00");
      assert.deepEqual([r1, g1, b1, a1], [255, 0, 0, 1]);

      const [r2, g2, b2, a2] = hexToRgb("#3b82f6");
      assert.deepEqual([r2, g2, b2, a2], [59, 130, 246, 1]);

      const [r3, g3, b3, a3] = hexToRgb("#10b98180");
      assert.equal(r3, 16);
      assert.equal(g3, 185);
      assert.equal(b3, 129);
      assert.ok(Math.abs(a3 - 0.5) < 0.02);
    });

    it("should parse HSL color values to sRGB accurately", () => {
      const [r, g, b] = hslToRgb(217, 91, 60);
      assert.ok(Math.abs(r - 59) <= 2);
      assert.ok(Math.abs(g - 130) <= 2);
      assert.ok(Math.abs(b - 246) <= 2);
    });

    it("should convert #3b82f6 to OKLCH with high precision matching DaisyUI 4 spec", () => {
      const [r, g, b] = hexToRgb("#3b82f6");
      const { L, C, H, formatted } = rgbToOklch(r, g, b);

      // Verify L is within 1% of 62.3%
      const lPercent = L * 100;
      assert.ok(Math.abs(lPercent - 62.3) < 0.5, `L% was ${lPercent}, expected ~62.3%`);

      // Verify H is ~259.8 deg
      assert.ok(Math.abs(H - 259.8) < 1.0, `Hue was ${H}, expected ~259.8`);

      // Verify C is positive chroma ~0.188
      assert.ok(C > 0.15 && C < 0.23, `Chroma was ${C}`);

      assert.ok(formatted.includes("%"), "Formatted string must include percentage for L");
      assert.ok(formatted.startsWith("62.3"), `Formatted output: ${formatted}`);
    });

    it("should handle pure black and pure white without NaN or hue divergence", () => {
      const black = rgbToOklch(0, 0, 0);
      assert.equal(black.L, 0);
      assert.equal(black.C, 0);
      assert.equal(black.formatted, "0.00% 0.000 0.00");

      const white = rgbToOklch(255, 255, 255);
      assert.ok(Math.abs(white.L - 1.0) < 0.001);
      assert.equal(white.C, 0);
      assert.ok(white.formatted.startsWith("100.00% 0.000"));
    });
  });

  describe("Automatic high-contrast content generator", () => {
    it("should generate near-black content for light backgrounds", () => {
      const contentForWhite = autoContrastContent("#ffffff");
      assert.ok(contentForWhite.startsWith("15% 0.02"), "Content for white must be near-black");

      const contentForYellow = autoContrastContent("#fef08a");
      assert.ok(contentForYellow.startsWith("15% 0.02"), "Content for yellow must be near-black");
    });

    it("should generate near-white content for dark backgrounds", () => {
      const contentForBlack = autoContrastContent("#000000");
      assert.ok(contentForBlack.startsWith("98% 0.01"), "Content for black must be near-white");

      const contentForDarkBlue = autoContrastContent("#0f172a");
      assert.ok(contentForDarkBlue.startsWith("98% 0.01"), "Content for dark navy must be near-white");
    });
  });

  describe("Theme compilation & inheritance (extends)", () => {
    it("should compile a JSON theme definition with semantic colors into DaisyUI 4 OKLCH CSS", () => {
      const result = compileTheme({
        "acme-brand": {
          primary: "#3b82f6",
          secondary: "#ec4899",
          accent: "#10b981",
          "--rounded-box": "0.75rem",
          "--rounded-btn": "0.375rem"
        }
      });

      assert.equal(result.themeName, "acme-brand");
      assert.ok(result.css.includes('[data-theme="acme-brand"] {'));
      assert.ok(result.css.includes("--p: 62.3"));
      assert.ok(result.css.includes("--s:"));
      assert.ok(result.css.includes("--a:"));
      assert.ok(result.css.includes("--rounded-box: 0.75rem;"));
      assert.ok(result.css.includes("--rounded-btn: 0.375rem;"));
      // Auto-contrast content colors
      assert.ok(result.css.includes("--pc:"));
      assert.ok(result.css.includes("--sc:"));
      assert.ok(result.css.includes("--ac:"));
    });

    it("should support base theme inheritance via 'extends: dark'", () => {
      const result = compileTheme({
        name: "acme-dark",
        extends: "dark",
        primary: "#3b82f6"
      });

      assert.equal(result.themeName, "acme-dark");
      assert.equal(result.variables["color-scheme"], "dark");
      // Inherits base dark background tokens
      assert.ok(result.variables["--b1"].includes("25.3267%"));
      // Overrides primary with #3b82f6 OKLCH
      assert.ok(result.variables["--p"].startsWith("62.3"));
    });

    it("should pass through raw CSS definitions cleanly", () => {
      const rawCss = `[data-theme="acme-raw"] {\n  color-scheme: dark;\n  --p: 45% 0.25 260;\n  --pc: 98% 0.01 260;\n}`;
      const result = compileTheme(rawCss);

      assert.equal(result.themeName, "acme-raw");
      assert.equal(result.isRawCss, true);
      assert.equal(result.css, rawCss);
    });

    it("should compile theme files from disk (JSON and CSS)", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "theme-test-"));
      try {
        const jsonPath = path.join(tmpDir, "brand.json");
        fs.writeFileSync(
          jsonPath,
          JSON.stringify({
            "emerald-custom": {
              extends: "emerald",
              primary: "#2563eb"
            }
          })
        );
        const jsonResult = compileThemeFile(jsonPath);
        assert.equal(jsonResult.themeName, "emerald-custom");
        assert.ok(jsonResult.css.includes('[data-theme="emerald-custom"]'));

        const cssPath = path.join(tmpDir, "custom.css");
        fs.writeFileSync(
          cssPath,
          `[data-theme="studio-css"] { --p: 50% 0.2 240; }`
        );
        const cssResult = compileThemeFile(cssPath);
        assert.equal(cssResult.themeName, "studio-css");
        assert.equal(cssResult.isRawCss, true);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("should generate a valid Tailwind config snippet", () => {
      const snippet = tailwindConfigSnippet("acme", {
        primary: "62.31% 0.188 259.81",
        "--rounded-box": "1rem"
      });
      assert.ok(snippet.includes('daisyui: {'));
      assert.ok(snippet.includes('"acme": {'));
      assert.ok(snippet.includes('"primary": "62.31% 0.188 259.81"'));
    });
  });
});
