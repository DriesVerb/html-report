# 🎨 Custom DaisyUI Themes & OKLCH Engine

`html-report` features a zero-dependency, pure JavaScript OKLCH color engine and compiler (`skills/html-report/scripts/theme-compiler.mjs`) that allows agents and users to define custom themes that seamlessly integrate with DaisyUI 4 and automatically adapt all Chart.js, Mermaid, and Grid.js visuals.

---

## 🔬 Zero-Dependency Pure JS OKLCH Engine

DaisyUI 4 uses the modern **OKLCH color space** (`oklch(L C H)`), which delivers perceptual uniformity and vibrant gradients without clipping in wide-gamut displays. 

Rather than pulling in heavy npm color libraries, `html-report` implements standard Ottosson matrix math directly in pure JavaScript:
1. **sRGB $\to$ Linear sRGB**: Gamma decompression.
2. **Linear sRGB $\to$ LMS Cone Space**: Linear matrix multiplication.
3. **LMS $\to$ OKLab**: Cube root non-linearity and transfer matrix.
4. **OKLab $\to$ OKLCH**: Cartesian to polar coordinates ($L$, $C = \sqrt{a^2 + b^2}$, $H = \text{atan2}(b, a)$).

---

## 🧬 Theme Definition & Inheritance (`extends`)

You can define custom themes using JSON or raw CSS. With the `"extends"` property, you can inherit from any of the 32 native DaisyUI themes (`dark`, `light`, `emerald`, `synthwave`, `nord`, etc.) while overriding only specific semantic colors.

### Example JSON Theme (`my-brand.json`):

```json
{
  "name": "my-brand",
  "extends": "dark",
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#ec4899",
    "accent": "#f59e0b",
    "neutral": "#1e293b",
    "base-100": "#0f172a"
  }
}
```

### Auto-Contrast Content Generation

When you specify base colors, the compiler automatically computes high-contrast values for their companion text variables (`--pc`, `--sc`, `--ac`, `--nc`, `--bc`) using luminance thresholding:
- Dark backgrounds receive light content colors.
- Light backgrounds receive dark content colors.

---

## 🛠️ Build-Time CLI Integration

Inject custom themes directly into your compiled report at build time:

```bash
# Inject JSON theme:
node skills/html-report/scripts/build-report.mjs \
  --title "Brand Report" \
  --content fragment.html \
  --custom-theme my-brand.json \
  --theme my-brand \
  --output report.html

# Inject raw CSS theme block:
node skills/html-report/scripts/build-report.mjs \
  --title "Brand Report" \
  --content fragment.html \
  --custom-theme brand-theme.css \
  --output report.html
```

---

## 🎛️ In-Browser Collapsible Theme Studio

Every report includes an interactive theme studio embedded directly beneath the navbar:
1. **Click the Studio Banner**: Expand the collapsible theme designer.
2. **Interactive Color Pickers**: Adjust Primary, Secondary, Accent, Neutral, and Base colors in real time.
3. **Live OKLCH Monitors**: Inspect live channel values (`L%`, `C`, `H`).
4. **Immediate Widget Reactivity**: Watch Chart.js canvas palettes, Mermaid nodes, and Grid.js borders re-render instantaneously.
5. **1-Click Export**: Copy the generated DaisyUI CSS block or Tailwind CSS configuration snippet with one click.
6. **Persistence**: Changes are saved to `localStorage` and restored automatically on page reloads.
