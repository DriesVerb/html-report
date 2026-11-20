---
name: html-pwa
description: >-
  Transforms HTML reports and dashboards into installable Progressive Web Apps (PWAs)
  with W3C manifests, dual-caching Service Workers, offline resilience, and dynamic
  theme-color synchronization. Use when the user asks to create a PWA, make an app
  installable, add offline caching, or build mobile field applications.
---

# Progressive Web App (PWA) Skill (`html-pwa`)

> **Domain Classification:** `Offline Packaging Modifier (--pwa)` | **Beneficiary:** `User-Facing` | **Serving Mode:** `Static File / Server-Connected` | **Behavioral Mode:** `Interactive / Reactive`

This specialized skill acts as a cross-cutting **Offline Packaging Modifier** (`--pwa`) that wraps any Interactive Delivery Archetype (`@html-report`, `@html-dashboard`, `@html-presentation`, or Studio) into an installable, offline-first app with **W3C Web App Manifests**, **dual-caching Service Workers**, and **dynamic theme-color synchronization**.

---

## Architecture & Offline Strategy

### 1. Dual-Caching Service Worker (`sw.js`)
- **Cache-First (CDN Assets)**: Tailored for external CDN dependencies (`cdn.tailwindcss.com`, `cdn.jsdelivr.net`, `unpkg.com`). Delivers 0ms responses from disk cache on subsequent visits.
- **Network-First with Cache-Fallback (HTML Document)**: Ensures users always get fresh data when connected, falling back immediately to the cached report if offline.

### 2. Manifest & Standalone App Shell
- Emits W3C-compliant `manifest.webmanifest` with `display: "standalone"`.
- Emits high-resolution scalable SVG icons (`icon.svg`) with maskable bounds.
- Automatically wires `#pwa-install-btn` in the navbar when browser fires `beforeinstallprompt`.

### 3. Reactive Theme-Color Synchronization
- The runtime automatically observes DaisyUI theme changes and synchronizes `<meta name="theme-color">` to match the active theme's primary/base color.

---

## Assembly & Retrofit Workflow

### Option A: Build New PWA Deliverable (`--pwa`)
Lint, auto-fix, and assemble a report with full PWA scaffolding enabled inside the gitignored `projects/<slug>/` folder:
```bash
node skills/html-report/scripts/harness.mjs run \
  --project field-inspection-app \
  --title "Field Inspection App" \
  --pwa --fast
```
This automatically produces inside `projects/field-inspection-app/`:
- `index.html` (with SW registration & manifest links)
- `manifest.webmanifest`
- `sw.js`
- `icon.svg`

### Option B: Retrofit ANY Existing Report (`generate-pwa.mjs`)
Transform any previously generated standalone HTML report into an installable PWA without modifying original code:
```bash
node skills/html-report/scripts/generate-pwa.mjs projects/audit-report/index.html \
  --title "Audit Report" \
  --short-name "AuditApp" \
  --theme-color "#10b981" \
  --emoji "📋"
```

### Option C: 1-Click Packaging & Install (`install-pwa.mjs` / `/html-install`)
Package the Creation Studio or any report as an offline-first app on port 3030:
```bash
node skills/html-report/scripts/install-pwa.mjs
# Or fast bash launcher:
./skills/html-report/scripts/install-pwa.sh
```

### Verification & Testing
Test PWA manifest and service worker compliance:
```bash
node --test tests/integration/pwa.test.mjs tests/integration/pwa.bdd.test.mjs
```

---

## Sibling Skill Routing
- **Standard Analytical Reports**: Use `@html-report` for desktop/web reports.
- **Printable PDFs & Invoices**: Use `@html-print` for document export.
- **Real-Time Telemetry**: Use `@html-dashboard` for SSE live streams.
- **Interactive Onboarding**: Use `@html-studio` to configure project requirements.
