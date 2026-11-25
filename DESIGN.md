# DESIGN.md — Agentic Tuneup Pro Design System

**Version:** 2.0 (Locked Final Linear Standard) · **Date:** 2026-11-25  
**Status:** FINAL & LOCKED — UI Style Frozen (No Further Style Changes)  
**Authority chain:** `PRD.md` (Product Scope) → `ARCHITECTURE.md` (Process Boundaries) → **this file (Locked Linear UI Law & Tokens)** → `API.md` (IPC & MCP Contracts) → `PLAN.md` (Engineering Roadmap)  
**Rule:** The Linear flat matte design system defined below is final and enforced automatically by `app/scripts/check-linear.mjs` (`npm --prefix app run check:linear`). Zero glass, zero blur, zero translucency, and zero dark-mode shadows are permitted.

---

## 1. Visual Standard & Forbidden Patterns

- **Linear Matte Architecture:** Every card, panel, sidebar, modal, and button uses flat, solid, opaque surfaces with `1px` crisp borders.
- **Themes:** Dual **Dark** (`data-theme="dark"`) and **Light** (`data-theme="light"`) themes persisted under `localStorage` key `ui-theme` (default follows OS `prefers-color-scheme`, applied inline in `app/index.html` before first paint). The toggle lives exclusively in the `40px` `TitleBar`.
- **Forbidden Everywhere:**
  - Frosted glass, `backdrop-filter`, `backdrop-blur-*`, vibrancy / mica / acrylic.
  - Translucent surface fills (`bg-white/10`, `bg-black/40`, `rgba(...)`, `hsla(...)`). Icon chips and status badges use precomputed solid theme tint variables (`--tint-*`).
  - Glows, inset highlights, and dark-mode `box-shadow` (light-mode cards allow at most `0 1px 2px rgb(16 24 40 / 5%)`).
  - Surface gradients (a subtle vertical gradient fade is allowed *only* beneath chart lines and sparklines).
  - Raw hex values in components outside `app/src/tailwind.css` and `app/src/components/linear/echarts-linear-theme.ts`.
  - macOS-style window traffic lights or left-side window buttons.
  - Pill-shaped cards, buttons, or chips (`rounded-full` is restricted strictly to status dots, avatars, and donut arc ends).

---

## 2. Color Tokens

### 2.1 Base Surface & Text Tokens

| Token | Dark | Light | Role |
| :--- | :--- | :--- | :--- |
| `--bg-app` | `#050505` | `#F3F4F6` | Main window shell, title bar, sidebar |
| `--bg-surface` | `#111213` | `#FFFFFF` | Cards, primary panels, dialogs, breadcrumb bar |
| `--bg-surface-2` | `#1A1B1E` | `#F4F5F7` | Active nav rows, inputs, tabs, code blocks |
| `--bg-bar-idle` | `#202128` | `#EAF0FF` | Progress tracks, idle chart bars, button hover |
| `--border` | `#1F2125` | `#E5E7EB` | Default `1px` dividers & card borders |
| `--border-strong` | `#2C2E33` | `#D1D5DB` | Interactive / elevated hover & modal borders |
| `--text` | `#F5F5F6` | `#0F1115` | Primary headings, body values, active labels |
| `--text-muted` | `#8A8B91` | `#6B7280` | Secondary descriptions, muted units, metadata |
| `--text-faint` | `#5A5B62` | `#9CA3AF` | Placeholders, inactive timestamps, subtle hints |

### 2.2 Semantic Accents & Solid Precomputed Tints

| Accent | Hex | Dark Solid Tint | Light Solid Tint | Semantic Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Blue** | `#3355FF` | `#141936` | `#EBF0FF` | Primary CTA (`--accent`), main chart series |
| **Sky** | `#38B6F0` | `#12232E` | `#E8F6FD` | Second chart series, active telemetry bars |
| **Green** | `#22C55E` | `#102419` | `#E9FAEF` | Healthy status, positive delta, safety boundary |
| **Red** | `#F43F5E` | `#291318` | `#FEECEF` | Tier 3 destructive actions, errors, negative delta |
| **Amber** | `#EAB308` | `#262010` | `#FEF7E0` | Warnings, running-app blocks, third series |
| **Teal** | `#1FB5A5` | `#102422` | `#E8F8F6` | Fourth chart series |
| **Pink** | `#EC4899` | `#291420` | `#FDECF4` | Fifth chart series |
| **Purple** | `#7C5CE6` | `#1D1730` | `#F1EEFD` | Sixth chart series, Flatpak badge |
| **Orange** | `#F97316` | `#291B10` | `#FFF1E6` | Seventh chart series |
| **Close Hover** | `#E5484D` | `#E5484D` | `#E5484D` | Window close button hover fill |

---

## 3. Window, Typography & Spacing Geometry

- **Window (`app/src-tauri/tauri.conf.json`):** `1280×800` default (16:10), `1024×640` minimum, `decorations: false`, `transparent: false`, `resizable: true`, `shadow: true`. Tauri capabilities allow minimize, toggle-maximize, close, start-dragging, and is-maximized.
- **Typography:** Self-hosted `Inter` (`@fontsource/inter` 400, 500, 600, 700). Root `html { font-size: 16px; }` with `body { font-size: 13px; }`.
  - Stat metrics: `28px` semibold with `tabular-nums`; units `12px` muted.
  - Table headers: `12px` uppercase with slight letter tracking.
  - Scale: `12 / 13 / 14 / 16 / 20 / 28 px`. Monospace (`ui-monospace`) restricted to logs, rule IDs, SHA-256 digests, and filesystem paths.
- **Minimal Rounding:**
  - Cards & dialogs: `8px` (`rounded-lg`).
  - Buttons & inputs: `6px` (`rounded-md`).
  - Chips, tags, version badge, tooltips: `4px` (`rounded`).
  - Status dots, gauge arc ends: round (`rounded-full`).
- **Spacing & Motion:** `4px` grid (`p-5` = `20px` card padding, `gap-4` = `16px` grid gap). Transitions strictly `150ms ease-out` with `prefers-reduced-motion` collapse.

---

## 4. Shared Linear Components (`app/src/components/linear/`)

| Component | Responsibility & Layout Contract |
| :--- | :--- |
| **`TitleBar`** | `40px` height (`h-10`), left `20px` logo + app name + `11px` version badge read from `tauri.conf.json`, draggable center (double-click maximize), right `ThemeToggle` \| divider \| minimize, maximize, `#E5484D` hover close. |
| **`ThemeToggle`** | Standalone `ui-theme` light/dark toggle emitting `theme-changed`. |
| **`Sidebar`** | `240px` expanded (`w-60`), collapsible to `56px` (`w-14`); `36px` (`h-9`) nav rows; integrated workspace profile switcher (`Daily`, `Dev`, `Server`); solid Safety Boundary footer card. |
| **`Breadcrumb`** | `44px` sub-header displaying `Workspace / Section`, Starship socket `StatusPill`, `Ctrl+K` command search button, and Agent drawer toggle. |
| **`LinearCard`** | Solid matte card (`8px` radius, `1px` border, zero dark shadow). |
| **`LinearButton`** | Primary, secondary, ghost, and danger button (`6px` radius, solid theme tints). |
| **`StatCard`** | Top uppercase label + solid square-rounded icon chip, `28px` tabular metric + muted unit + inline sparkline, solid delta tag + comparison text. |
| **`DonutLegend`** | Color square (`rounded-[2px]`), label, right-aligned tabular value, dashed row dividers. |
| **`ProgressRow`** | Single-line label & tabular value above a `4px` (`h-1`) track (`--bg-bar-idle`) with colored fill. |
| **`RangeTabs`** | `1W / 1M / 3W / YTD / Total` chart timeframe switcher. |
| **`DataTable`** | Tabular data container with `12px` uppercase header row and solid `1px` row dividers. |
| **`StatusPill`** | Flat border tag (`4px` radius) with non-glowing status dot (`green`, `blue`, `amber`, `red`, `faint`). |
| **`LinearDialog`** | Solid modal card (`8px` radius) centered on a dimmed backdrop scrim (`.linear-scrim`) with `Esc` close handling. |
| **`echarts-linear-theme.ts`** | Reactive dark/light ECharts configuration (`transparent` background, dotted gridlines, `12px` Inter axis labels, `4px` bordered tooltip, shared 8-color accent sequence). |

---

*UI Design Locked — Zvirox / Agentic Tuneup Pro.*
