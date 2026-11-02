import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  extractLeafCaller,
  getOutputPath,
  getOutputPaths
} from "../skills/html-report/scripts/caller-registry.mjs";

describe("Caller CWD Output Routing & Leaf Identification", () => {
  describe("extractLeafCaller", () => {
    it("should extract direct leaf identifier from single caller string", () => {
      assert.equal(extractLeafCaller("a11y-debugging"), "a11y-debugging");
      assert.equal(extractLeafCaller("memory-leak-debugging"), "memory-leak-debugging");
    });

    it("should normalize chained orchestrator / subagent paths", () => {
      assert.equal(extractLeafCaller("teamwork/memory-leak-debugging"), "memory-leak-debugging");
      assert.equal(extractLeafCaller("orchestrator/worker-agent/troubleshooting"), "troubleshooting");
      assert.equal(extractLeafCaller("root\\subagent\\debug-optimize-lcp"), "debug-optimize-lcp");
    });

    it("should trim trailing and multiple slashes", () => {
      assert.equal(extractLeafCaller("teamwork/subagent/"), "subagent");
      assert.equal(extractLeafCaller("///agent-leaf///"), "agent-leaf");
      assert.equal(extractLeafCaller(""), "default");
      assert.equal(extractLeafCaller(null), "default");
    });
  });

  describe("getOutputPath & getOutputPaths", () => {
    it("should default to ./report-<callerId>.html and .pdf in CWD", () => {
      const mockCwd = "/workspace/project-alpha";
      const singleHtml = getOutputPath("a11y-debugging", null, { cwd: mockCwd });
      assert.equal(singleHtml, path.join(mockCwd, "report-a11y-debugging.html"));

      const paths = getOutputPaths("a11y-debugging", null, { cwd: mockCwd });
      assert.equal(paths.htmlPath, path.join(mockCwd, "report-a11y-debugging.html"));
      assert.equal(paths.pdfPath, path.join(mockCwd, "report-a11y-debugging.pdf"));
    });

    it("should extract leaf caller for output file names when caller is chained", () => {
      const mockCwd = "/workspace/my-app";
      const paths = getOutputPaths("teamwork/subagent/memory-leak-debugging", null, { cwd: mockCwd });
      assert.equal(paths.htmlPath, path.join(mockCwd, "report-memory-leak-debugging.html"));
      assert.equal(paths.pdfPath, path.join(mockCwd, "report-memory-leak-debugging.pdf"));
    });

    it("should honor explicit output path when supplied", () => {
      const mockCwd = "/workspace/my-app";
      const explicit = "custom/dest/final-report.html";
      const resolved = getOutputPath("a11y-debugging", explicit, { cwd: mockCwd });
      assert.equal(resolved, path.join(mockCwd, "custom/dest/final-report.html"));

      const paths = getOutputPaths("a11y-debugging", explicit, { cwd: mockCwd });
      assert.equal(paths.htmlPath, path.join(mockCwd, "custom/dest/final-report.html"));
      assert.equal(paths.pdfPath, path.join(mockCwd, "custom/dest/final-report.pdf"));
    });
  });
});
