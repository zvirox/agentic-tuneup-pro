# Color Audit — Agentic Tuneup Pro (`app/src`)

**Date:** 2026-11-26 · **Scope:** Pre-migration color & token audit across `app/src/` and `app/index.html` ahead of the shared Linear color migration (Cyan primary + Charcoal/Graphite dark + Sky positive; zero green, zero teal).

---

## 1. Raw Hex & Alpha Literals Outside Shared Theme Files

| File | Line(s) | Found Value | Classification | Target Token |
|---|---|---|---|---|
| `app/src/tailwind.css` | 16–126 | Old token hexes (`#050505`, `#111213`, `#1A1B1E`, `#202128`, `#1F2125`, `#2C2E33`, `#F5F5F6`, `#8A8B91`, `#5A5B62`, `#0F1115`, `#6B7280`, `#9CA3AF`, `#F3F4F6`, `#F4F5F7`, `#EAF0FF`, `#3355FF`, `#38B6F0`, `#22C55E`, `#F43F5E`, `#EAB308`, `#1FB5A5`, `#EC4899`, `#7C5CE6`, `#F97316`, `--tint-*`) | Retired palette & old green/teal/blue | Replaced by `src/styles/linear-theme.css` + `src/styles/app-accent.css` + `@theme inline` mapping |
| `app/src/tailwind.css` | 134 | `color-mix(in srgb, #050505 72%, transparent)` | `.linear-scrim` raw hex | Use `var(--scrim)` |
| `app/src/components/linear/echarts-linear-theme.ts` | 2–20, 61 | Raw hex literals (`#3355FF`, `#38B6F0`, `#22C55E`, `#F43F5E`, `#EAB308`, `#1FB5A5`, `#EC4899`, `#7C5CE6`, `#F97316`, `#202128`, `#EAF0FF`, `#1F2125`, `#111213`, `#8A8B91`, `#6B7280`, `#F5F5F6`, `#0F1115`, `rgb(16 24 40 / 5%)`) + green/teal | Hardcoded chart hex palette | Runtime `getComputedStyle(document.documentElement)` reads of CSS vars; `extraCssText` `box-shadow: var(--shadow-card)` |

---

## 2. Green / Teal Usages (Must Remove Completely)

| File | Line(s) | Current Token / Symbol | Role | Replacement Token |
|---|---|---|---|---|
| `app/src/tailwind.css` | 18, 21, 34, 37, 71–72, 78–79, 112–113, 119–120 | `--color-green`, `--color-teal`, `--tint-green*`, `--tint-teal*` | Green & teal definitions | Deleted |
| `app/src/components/linear/StatCard.tsx` | 10, 13, 48, 138 | `green` / `teal` tones, `var(--color-green)`, `bg-[var(--tint-green)]` | Icon chip, positive sparkline & delta badge | `--sky`, `--sky-text`, `--chip-sky`, `--chart-fade-up` |
| `app/src/components/linear/StatusPill.tsx` | 12 | `bg-[var(--color-green)]` | `online` status dot | `bg-sky` (`--sky`) |
| `app/src/components/linear/Sidebar.tsx` | 141, 151 | `bg-[var(--tint-green)] border-[var(--tint-green-border)] text-[var(--color-green)]` | Safety Boundary seal | `bg-chip-sky border-border text-sky-text` |
| `app/src/components/HealthGauge.tsx` | 24, 48, 134 | `var(--color-green)` | Healthy donut arc, legend, optimal state | `var(--sky)` / `text-sky` |
| `app/src/components/TelemetrySparkline.tsx` | 22 | `color = "var(--color-green)"` | Default sparkline color | `var(--sky)` + `--chart-fade-up` / `--chart-fade-down` |
| `app/src/components/UndoButton.tsx` | 56 | `bg-[var(--tint-green)] border-[var(--tint-green-border)] text-[var(--color-green)]` | "Restored successfully" pill | `bg-chip-sky border-border text-sky-text` |
| `app/src/components/CategoryTree.tsx` | 100 | `var(--color-green)` | Distribution progress bar | `var(--sky)` / `var(--amber)` / `var(--pink)` / `var(--purple)` |
| `app/src/components/QuarantineView.tsx` | 253 | `text-[var(--color-green)]` | "Restored to original location" label | `text-sky-text` |
| `app/src/components/AuditTimeline.tsx` | 50 | `bg-[var(--tint-green)] text-[var(--color-green)] border-[var(--tint-green-border)]` | Tier 1 · Safe badge | `bg-chip-sky text-sky-text border-border` |
| `app/src/components/AppsView.tsx` | 372, 437, 484 | `text-[var(--color-green)]` | Checkmark icons & freed disk delta | `text-sky` / `text-sky-text` |
| `app/src/components/ProcessExplorer.tsx` | 345, 502 | `text-[var(--color-green)]`, `bg-[var(--tint-green)]` | Start button icon & Autostart Enabled switch | `text-sky` / `bg-chip-sky text-sky-text border-border` |
| `app/src/components/DiagnosticModal.tsx` | 113, 225 | `bg-[var(--tint-green)]`, `text-[var(--color-green)]` | Nominal Performance tag & healthy checkmark | `bg-chip-sky text-sky-text border-border` / `text-sky` |
| `app/src/components/AgentDrawer.tsx` | 242, 326, 352, 379 | `bg-[var(--color-green)]`, `text-[var(--color-green)]` | Online dot, safety check, action icon, est delta | `bg-sky` / `text-sky` / `text-sky-text` |
| `app/src/components/PlanStepCard.tsx` | 33, 42, 84 | `--tint-green*`, `--color-green` | Completed step border, Tier 1 tag, Completed label | `border-sky` / `bg-chip-sky text-sky-text` / `text-sky` |
| `app/src/App.tsx` | 585 | `color="var(--color-green)"` | Network In sparkline | `var(--sky)` |

---

## 3. Legacy Primary (`--accent`), Old `--tint-*`, and Multi-Role Split Mappings

| File | Current Usage | Replacement Role / Token |
|---|---|---|
| `app/src/App.tsx`, `Breadcrumb.tsx`, `Sidebar.tsx`, `LinearButton.tsx`, `RangeTabs.tsx`, `CommandPalette.tsx`, `AgentDrawer.tsx`, `CategoryTree.tsx`, `QuarantineView.tsx`, `AuditTimeline.tsx`, `AppsView.tsx`, `ProcessExplorer.tsx`, `PlanStepCard.tsx`, `SamplePathsModal.tsx`, `DiagnosticModal.tsx`, `VoiceWaveform.tsx` | `--accent`, `--accent-hover`, `--accent-active`, `--accent-fg`, `accent-[var(--accent)]` | `--primary`, `--primary-hover`, `--primary-fg`, `--primary-text` |
| Same files | `--tint-blue`, `--tint-blue-border`, `--tint-sky*`, `--tint-red*`, `--tint-amber*`, `--tint-purple*`, `--tint-orange` | `--primary-tint`, `--chip-sky`, `--chip-red`, `--bg-surface-2` + semantic text (`text-amber`, `text-purple`, `text-orange`, `text-red-text`) + `--border` / `--red` / `--amber` |
| `app/src/components/LinearCard.tsx`, `RangeTabs.tsx` | `.linear-card` | `.shadow-card` (with `--shadow-card` in `linear-theme.css`) |
| `app/src/components/LinearDialog.tsx` | `.linear-scrim` | `bg-scrim` (`var(--scrim)`) |
| `app/src/components/Sidebar.tsx` | `bg-[var(--bg-app)]`, `bg-[var(--bg-surface-2)]`, `hover:bg-[var(--bg-surface)]` | `bg-sidebar`, `bg-active` (active nav), `hover:bg-hover` (hovered nav) |
| `app/src/components/TitleBar.tsx` | `hover:bg-[var(--bg-surface-2)]`, `hover:text-white` | `hover:bg-hover`, `hover:text-white` (`hover:text-[var(--text)]` in light/dark; close hover text `#FFFFFF` stays crisp white using `hover:text-fg` or `bg-close-hover text-white` -> keep token or `text-white` check: note `white` hex vs keyword `text-white`!) |
| `app/src/components/HealthGauge.tsx`, `ProgressRow.tsx` | `stroke="var(--bg-bar-idle)"`, `bg-[var(--bg-bar-idle)]` | `var(--bg-track)` / `bg-track` |
| `app/src/App.tsx` Telemetry Chart & Analyzer | `LINEAR_SERIES_ORDER` (blue, sky, green...) | ATP series order: `--primary`, `--sky`, `--amber`, `--pink`, `--purple`; CPU=`--primary`, Memory=`--orange`, Disk=`--purple`; Cleanable=`--primary` |
| `app/src/components/ProcessExplorer.tsx` | `color="var(--color-blue)"`, `color="var(--color-sky)"` | CPU progress fill = `var(--primary)`, Memory = `var(--sky)` |
