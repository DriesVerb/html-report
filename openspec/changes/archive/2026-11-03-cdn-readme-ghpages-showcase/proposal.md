# Proposal: CDN Documentation, GitHub Pages Parity & Showcase Update

## 1. Problem Statement & Context
The `html-report` repository recently completed a major expansion to support 16 modular CDN libraries (adding Day.js, Impress.js, Mock.js, Showdown, and FullCalendar) along with cryptographic Subresource Integrity (SRI) hashes, Content Security Policy (CSP), and `no-referrer` security hardening.

However, several public-facing documentation and landing artifacts have not yet been synchronized:
1. **README.md**:
   - Lacks a prominent link to the live GitHub Pages showcase at the top.
   - References outdated test counts (92 tests instead of 142) and legacy 11-CDN catalog counts in structural references.
   - Does not document the SRI, CSP, and no-referrer security layer or the 5 newly supported CDN addons.
2. **GitHub Pages (`index.html` at root)**:
   - Still displays the older 11-CDN showcase without Section 11 (Day.js, Impress.js with Presentation Guard, Mock.js, Showdown, FullCalendar).
   - Lacks the 16-card directory grid and modern SRI/CSP head tags present in `template-shell.html`.
3. **Reference Example (`skills/html-report/examples/example.html`)**:
   - Contains Section 11 markup, but must be fully verified and synchronized to ensure identical capability and seamless standalone rendering alongside the GitHub Page showcase.

## 2. Proposed Solution
1. **Elevate `README.md`**:
   - Add a high-visibility GitHub Pages link (`https://driesverb.github.io/html-report/`) and badge right at the top.
   - Document the complete 16-library CDN power stack with full descriptions for Day.js, Impress.js, Mock.js, Showdown, and FullCalendar.
   - Document the Subresource Integrity (SRI), CSP, and referrer security architecture.
   - Update test suite metrics to 142 tests passing in ~2s.
2. **Update GitHub Pages (`index.html`)**:
   - Upgrade to the publication-grade 16-CDN interactive capabilities showcase.
   - Add Section 11 with live interactive demonstrations for Day.js, Impress.js (with presentation mode toggle and print-safe fallback), Mock.js synthetic data generator, Showdown two-way markdown compiler, and FullCalendar 6 interactive schedule.
   - Inject modern SRI integrity hashes, CSP meta, and `no-referrer` tags matching `template-shell.html`.
   - Update runtime initialization logic and Grid.js catalog table to include all 16 libraries.
3. **Harmonize `skills/html-report/examples/example.html`**:
   - Ensure the fragment showcase contains all necessary client-side handlers and matches the GitHub Pages showcase structure.
4. **Comprehensive Automated Verification**:
   - Execute the 142 Node.js unit and integration tests.
   - Validate both `index.html` and `example.html` with Playwright in headless Chromium to guarantee zero console errors, zero unhandled exceptions, and active styles.
5. **OpenSpec Journey Tracking & Distribution**:
   - Maintain living journey state on `localhost:3000` via `implementation-progress.html`.
   - Archive the change upon successful verification.
   - Commit cleanly and push to `origin/main`.
