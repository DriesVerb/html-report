# Proposal: Deterministic Offline Inlining Bundle (Option 2 Implementation)

## 1. Problem Statement & Context
The current publication pipeline for `html-report` defaults to referencing 16 modular libraries from public CDNs (`cdn.jsdelivr.net`, `cdn.tailwindcss.com`, `cdnjs.com`). While this keeps initial report HTML documents tiny (~40KB), it creates severe operational constraints in sensitive enterprise environments:

1. **Air-Gapped & Offline Failures:** Defense, healthcare, banking, isolated staging runners, and offline workstations cannot fetch third-party CDNs. Opening a report in these environments results in unstyled, broken visuals.
2. **Operational Security (OPSEC):** Outbound CDN calls transmit client IP addresses, browser user-agents, and document referrers to external CDN edge providers.
3. **Supply-Chain Dependency:** Reliance on third-party CDNs introduces external uptime and integrity dependencies.

Option 2 (**Full Inlining**) was evaluated and selected as the safest, most shareable, and highest-integrity distribution pattern. It requires **zero `node_modules`**, opens directly via `file:///` on double-click, and eliminates running daemon processes or open ports.

The sole engineering trade-off is document file size (~1.5MB–3.5MB uncompressed). This proposal addresses that trade-off through smart selective asset packaging, deterministic source map stripping, and zero-dependency Brotli/Gzip artifact bundling.

---

## 2. Proposed Solution
Implement a deterministic, zero-dependency offline inlining subsystem across the `html-report` toolchain:

1. **Deterministic Inlining Flag (`--inline`):**
   - Automatically inlines all active CSS into `<style>` tags and JS into `<script>` tags.
   - Only bundles the libraries actually detected or requested in the report fragment (e.g. core-only reports remain under 650KB).
2. **Local Asset Vault (`skills/html-report/assets/vendor/`):**
   - Stores pinned, audited copies of all 16 ecosystem libraries with SHA-256 integrity verification.
3. **Air-Gapped Playwright Verification Gate (`--offline` / `--air-gapped`):**
   - Playwright verification test suite that intercepts all network requests, strictly aborts any outbound HTTP/HTTPS calls, and proves the report renders identically under `file:///` protocol across all 5 responsive breakpoints with 0 network calls.
4. **Compression Pipeline (`--compress`):**
   - Uses native `node:zlib` to generate pre-compressed `.html.br` and `.html.gz` archives, reducing total delivery size to ~350KB.
