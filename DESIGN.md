# DESIGN.md — Agentic Tuneup Pro Design System

**Version:** 2.1 (Locked Shared Linear Standard · Cyan Primary) · **Date:** 2026-11-26  
**Status:** FINAL & LOCKED — UI Style & Palette Frozen  
**Authority chain:** `PRD.md` (Product Scope) → `ARCHITECTURE.md` (Process Boundaries) → **this file (Locked Linear UI Law & Tokens)** → `API.md` (IPC & MCP Contracts) → `PLAN.md` (Engineering Roadmap)  
**Rule:** The Linear flat matte design system defined below is final and enforced automatically by `app/scripts/check-linear.mjs` (`npm --prefix app run check:linear`).

---

## 1. Visual Standard & Forbidden Patterns

- **Linear Matte Architecture:** Every card, panel, sidebar, modal, and button uses flat, solid, opaque surfaces with `1px` crisp borders. Shared card elevation uses `--shadow-card` (`.shadow-card`).
- **Themes:** Dual **Dark** (`data-theme="dark"`) and **Light** (`data-theme="light"`) themes persisted under `localStorage` key `ui-theme` (default follows OS `prefers-color-scheme`, applied inline in `app/index.html` before first paint). The toggle lives exclusively in the `40px` `TitleBar`.
- **Zero Green / Teal:** Green and teal (`--green`, `--teal`, green hues 75°–170°) are removed from the palette. Positive, healthy, online, done, and upward states use `--sky`, `--sky-text`, and `--chip-sky`.
- **Forbidden Everywhere:**
  - Frosted glass, `backdrop-filter`, `blur()`, `backdrop-blur-*`, vibrancy / mica / acrylic.
  - Translucent surface fills (`bg-white/*`, `bg-black/*`). Alpha values are permitted *only* in `--scrim`, `--chart-fade-up`, `--chart-fade-down`, and `--shadow-card` inside `app/src/styles/linear-theme.css`.
  - Glows, inset highlights, and any `box-shadow` other than `var(--shadow-card)`.
  - Surface gradients (a subtle vertical gradient fade is allowed *only* beneath chart lines and sparklines).
  - Raw hex, `rgb()`, `hsl()`, and Tailwind palette classes outside `app/src/styles/linear-theme.css` and `app/src/styles/app-accent.css`.
  - Retired palette hex values and foreign app primary accents.
  - macOS-style window traffic lights or left-side window buttons.
  - Pill-shaped cards, buttons, or chips (`rounded-full` is restricted strictly to status dots, avatars, and donut arc ends).

---

## 2. Color Tokens

### 2.1 Shared Palette (`app/src/styles/linear-theme.css`)

| Token | Dark | Light | Role |
| :--- | :--- | :--- | :--- |
| `--bg-app` | `#1C1C1C` | `#F8F9FA` | Window, title bar, breadcrumb bar, main area |
| `--bg-sidebar` | `#1C1C1C` | `#F3F4F6` | Sidebar and left rail |
| `--bg-surface` | `#1C1C1C` | `#FFFFFF` | Cards, panels, dialogs, command palette |
| `--bg-surface-2` | `#292929` | `#F3F4F6` | Inputs, version tag, count badge, status pill fill, icon chip, nested boxes, tooltip body |
| `--bg-active` | `#292929` | `#E5E7EB` | Active nav item, selected range tab |
| `--bg-hover` | `#232323` | `#EEF0F2` | Hovered nav item, title bar button hover |
| `--bg-track` | `#333333` | `#E5E7EB` | Switch off track, progress track, donut tick ring |
| `--bg-bar-idle` | `#333333` | `#E5E7EB` | Unselected chart bars |
| `--border` | `#2E2E2E` | `#E5E7EB` | `1px` hairlines, table row dividers, dashed legend dividers, default borders |
| `--border-strong` | `#363636` | `#D1D5DB` | Card hover border, dialog and tooltip borders, selected tab border |
| `--chart-grid` | `#2E2E2E` | `#D1D5DB` | Dotted chart gridlines |
| `--text` | `#FFFFFF` | `#111827` | Headings, big numbers, active tab, current breadcrumb |
| `--text-secondary` | `#CBCBCB` | `#111827` | Body text, labels, table row text, ghost button text, nav items |
| `--text-muted` | `#B4B4B4` | `#5B6370` | Units, timestamps, table headers, version tag text, unselected tabs |
| `--text-faint` | `#939393` | `#818998` | Hints, expand icons, idle status dot |
| `--blue` | `#346AFE` | `#2563EB` | Plain series color |
| `--sky` | `#2FADFF` | `#0284C7` | Positive: healthy, online, done, up, series 2 |
| `--sky-text` | `#2FADFF` | `#0369A1` | Positive delta text, positive icon/chip text |
| `--amber` | `#F6940F` | `#D97706` | Warning, running-app blocks, series color |
| `--pink` | `#FC669B` | `#DB2777` | Series color |
| `--purple` | `#6D59F9` | `#6D28D9` | Series color, Flatpak badge text |
| `--orange` | `#FB6801` | `#EA580C` | Memory series color |
| `--red` | `#FC4232` | `#DC2626` | Error, critical, alert dot, down sparkline, negative border |
| `--red-text` | `#FF6B5E` | `#B91C1C` | Negative delta text and destructive labels |
| `--gray` | `#4F4F4F` | `#868E9C` | Neutral series |
| `--chip-sky` | `#1F303C` | `#E0F2FE` | Positive delta chip, Done / Safe chip |
| `--chip-red` | `#2D1F1F` | `#FEE2E2` | Negative delta chip, Tier 3 destructive chip |
| `--close-hover` | `#E5484D` | `#E5484D` | Window close button hover fill (icon stays `#FFFFFF`) |
| `--scrim` | `rgba(0,0,0,0.7)` | `rgba(0,0,0,0.4)` | Dialog backdrop (solid dim, no blur) |
| `--shadow-card` | `0 12px 28px -6px rgba(0,0,0,0.5)` | `0 1px 2px rgb(16 24 40 / 5%)` | Allowed card elevation shadow (`.shadow-card`) |
| `--chart-fade-up` | `rgba(47,173,255,0.15)` | `rgba(2,132,199,0.1)` | Gradient fade under upward sparklines |
| `--chart-fade-down` | `rgba(252,66,50,0.15)` | `rgba(220,38,38,0.1)` | Gradient fade under downward sparklines |

### 2.2 App Primary Accent: Cyan (`app/src/styles/app-accent.css`)

| Token | Dark | Light | Role |
| :--- | :--- | :--- | :--- |
| `--primary` | `#06B6D4` | `#0E7490` | Primary button fill, switch on, slider, selected border, CPU live series, process CPU bar |
| `--primary-hover` | `#24BFD9` | `#0C667F` | Primary button hover |
| `--primary-fg` | `#1C1C1C` | `#FFFFFF` | Primary button text |
| `--primary-text` | `#22D3EE` | `#0E7490` | Links, 2px focus ring, active nav icon, chip text |
| `--primary-tint` | `#193236` | `#EEF5F7` | Assigned / info chip fill |

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
| **`TitleBar`** | `40px` height (`h-10`), `bg-app`, left `20px` logo + app name + `11px` version badge read from `tauri.conf.json`, draggable center (double-click maximize), right `ThemeToggle` \| divider \| minimize, maximize, `--close-hover` hover close. |
| **`ThemeToggle`** | Standalone `ui-theme` light/dark toggle emitting `theme-changed`. |
| **`Sidebar`** | `240px` expanded (`w-60`), collapsible to `56px` (`w-14`), `bg-sidebar`; `36px` (`h-9`) nav rows (`bg-active`, `--primary-text` active icon); integrated workspace switcher (`Daily`, `Dev`, `Server`); `--chip-sky` Safety Boundary footer card. |
| **`Breadcrumb`** | `44px` sub-header (`bg-app`) displaying `Workspace / Section`, Starship socket `StatusPill`, `Ctrl+K` command search button, and Agent drawer toggle. |
| **`LinearCard`** | Solid matte card (`8px` radius, `1px` border, `.shadow-card`). |
| **`LinearButton`** | Primary (`--primary` / `--primary-fg`), secondary, ghost, and danger (`--chip-red` / `--red-text`) buttons (`6px` radius). |
| **`StatCard`** | Top uppercase label + solid square-rounded icon chip, `28px` tabular metric + muted unit + inline sparkline (`--sky` / `--red`), solid delta tag (`--chip-sky` / `--chip-red`) + comparison text. |
| **`DonutLegend`** | Color square (`rounded-[2px]`), label, right-aligned tabular value, dashed row dividers. |
| **`ProgressRow`** | Single-line label & tabular value above a `4px` (`h-1`) track (`--bg-track`) with colored fill (`--primary` default). |
| **`RangeTabs`** | `1W / 1M / 3W / YTD / Total` chart timeframe switcher (`--bg-active` active pill). |
| **`DataTable`** | Tabular data container with `12px` uppercase header row (`bg-surface-2`) and solid `1px` row dividers. |
| **`StatusPill`** | Flat border tag (`4px` radius, `bg-surface-2`) with non-glowing status dot (`sky`, `primary`, `amber`, `red`, `faint`). |
| **`LinearDialog`** | Solid modal card (`8px` radius) centered on a dimmed backdrop scrim (`bg-scrim`) with `Esc` close handling. |
| **`echarts-linear-theme.ts`** | Reactive ECharts configuration reading CSS variables via `getComputedStyle(document.documentElement)` on theme change (ATP series order: `--primary`, `--sky`, `--amber`, `--pink`, `--purple`; live telemetry uses CPU `--primary`, Memory `--orange`, Disk `--purple`). |

---

*UI Design Locked — Zvirox / Agentic Tuneup Pro.*
