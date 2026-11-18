# DESIGN.md — Agentic Tuneup Pro Design System

**Version:** 1.0 · **Date:** 2026-11-18  
**Status:** UI & Visual Law  
**Authority chain:** `PRD.md` (Product Requirements) → `ARCHITECTURE.md` (Process Boundaries & Transports) → **this file (UI Law, Design Tokens & Component Recipes)** → `API.md` (IPC & MCP Contracts) → `PLAN.md` (Roadmap)  
**Rule:** Every user interface surface, component, icon, and motion in Agentic Tuneup Pro (ATP) must adhere strictly to this specification. Do not invent ad-hoc hex values, spacing sizes, or non-tokenized animations. To alter a token or recipe, update this document first.

---

## 1. Brand Feel & Visual Principles

**Feel:** Mission control meets industrial cyber-defense. Precision, transparency, and calm authority. Built specifically for modern Linux desktop compositors (KDE Plasma 6, Hyprland, GNOME, Sway, MangoWC) using frosted-glass compositing, razor-sharp typography, and instantaneous visual feedback.

### Principle 1 — Total Transparency Over Black Boxes
Linux users demand honesty. The UI never hides behind opaque "Clean Now" magic buttons. Every surface clearly shows:
- Exact filesystem paths, sizes, and file counts.
- Why an item was flagged (rule explanation and safety rationale).
- Where cleaned files will be stored (quarantine directory).
- Reversibility status (Reversible with one-click Undo vs. Destructive).

### Principle 2 — Glass with a Contrast Floor
Translucency must never compromise readability. Every frosted-glass layer pairs a tinted surface fill (`rgba(255, 255, 255, 0.055)`) with a hardware backdrop blur (`24px` to `32px`), an inner 1px specular highlight border (`rgba(255, 255, 255, 0.15)`), and an obsidian base canvas (`#080B10`).
- If a compositor lacks blur protocols (e.g. pure X11 without Compton/Picom) or the user enables **Reduce Effects**, the UI gracefully drops blur (`--blur: 0px`) and shifts to high-density solid obsidian tokens without layout shifts.

### Principle 3 — Signal-Driven Color Economy
Color is strictly semantic, never decorative:
- **Electric Cyan (`#38BDF8`)**: Primary interactive accent, selected filters, active agent execution.
- **Amber (`#F59E0B`)**: Agent scanning / analyzing, system resource warnings, pending updates.
- **Emerald (`#10B981`)**: Verified safe, quarantine active, healthy system state, services running.
- **Rose (`#F43F5E`)**: Tier 3 Destructive approval gate, runaway CPU/memory alerts, kill confirmation.
- **Violet (`#A855F7`)**: Developer artifacts, container volumes, local AI model execution.

### Principle 4 — Motion is Operational Feedback (WebKitGTK Optimized)
Animations communicate physical state and state changes:
- Transitions use GPU-friendly CSS transforms and opacity (`framer-motion` springs, 180–240ms).
- Continuous background blur animations (e.g. floating blur orbs) are **strictly forbidden** to prevent WebKitGTK software-rasterization spikes on Linux.
- All animations instantly collapse to 0ms when `prefers-reduced-motion` is detected.

---

## 2. Color Tokens

### 2.1 Dark Mode (Default & Primary Desktop Theme)

| Token | Hex / CSS Value | Semantic Role |
|---|---|---|
| `bg.canvas` | `#080B10` | Base desktop canvas beneath all glass surfaces |
| `bg.raised` | `#0E131B` | Opaque cards, settings panels, table backgrounds |
| `surface.glass` | `rgba(255, 255, 255, 0.055)` | Standard glass fill (Dashboard cards, sidebar panels) |
| `surface.glass-strong` | `rgba(14, 19, 27, 0.82)` | High-density glass (Agent Drawer, Modals, Toasts) |
| `surface.solid` | `#141B26` | Resting cards, Task Sheet step containers, dialogs |
| `surface.sunken` | `rgba(0, 0, 0, 0.35)` | Input fields, search bars, code blocks, sparkline troughs |
| `border.subtle` | `rgba(255, 255, 255, 0.08)` | Dividers, separators, inactive card boundaries |
| `border.glass` | `rgba(255, 255, 255, 0.15)` | 1px inner specular stroke on glass containers |
| `border.focus` | `#38BDF8` | Universal keyboard focus indicator (2px outline) |
| `text.primary` | `#F1F5F9` | Headings, active values, primary button labels |
| `text.secondary` | `rgba(241, 245, 249, 0.68)` | Subtitles, rule descriptions, metadata, timestamps |
| `text.disabled` | `rgba(241, 245, 249, 0.38)` | Placeholders, inactive backends, disabled controls |
| `accent` | `#38BDF8` | Electric Cyan: primary buttons, active tabs, clean CTA |
| `accent.hover` | `#7DD3FC` | Interactive hover state for primary controls |
| `accent.active` | `#0284C7` | Pressed state for primary controls |
| `accent.muted` | `rgba(56, 189, 248, 0.14)` | Selected table rows, active navigation background |
| `accent.text` | `#031726` | High-contrast text on solid cyan buttons |
| `signal.thinking` | `#F59E0B` | Amber: agent scanning, background analysis |
| `signal.thinking-bg` | `rgba(245, 158, 11, 0.12)` | Amber tint on pending plan cards |
| `signal.success` | `#10B981` | Emerald: clean complete, quarantine active, healthy state |
| `signal.success-bg` | `rgba(16, 185, 129, 0.12)` | Emerald badge background |
| `signal.gate` | `#F43F5E` | Rose: Tier 3 approval required, kill process, purge |
| `signal.gate-bg` | `rgba(244, 63, 94, 0.14)` | Rose alert background & pulsating rim |
| `signal.dev` | `#A855F7` | Violet: `node_modules`, `target/`, Docker cache |

### 2.2 Package Manager Source Badges

| Source | Badge Text Color | Badge Background Color | Border Color |
|---|---|---|---|
| **Flatpak** | `#7DD3FC` (Cyan) | `rgba(125, 211, 252, 0.12)` | `rgba(125, 211, 252, 0.25)` |
| **Arch (pacman)** | `#38BDF8` (Sky) | `rgba(56, 189, 248, 0.12)` | `rgba(56, 189, 248, 0.25)` |
| **Debian / Ubuntu (apt)**| `#F87171` (Red) | `rgba(248, 113, 113, 0.12)` | `rgba(248, 113, 113, 0.25)` |
| **Fedora (dnf)** | `#60A5FA` (Blue) | `rgba(96, 165, 250, 0.12)` | `rgba(96, 165, 250, 0.25)` |
| **AppImage** | `#34D399` (Mint) | `rgba(52, 211, 153, 0.12)` | `rgba(52, 211, 153, 0.25)` |
| **Snap** | `#FB923C` (Orange) | `rgba(251, 146, 60, 0.12)` | `rgba(251, 146, 60, 0.25)` |

---

## 3. Typography Specification

To maintain visual unity across the Mother Ship suite (Easy Edits Pro, ScreenStudio Pro, Audio Labs Pro, Starship Control), ATP adopts the exact font pairings:

| Font Face | Format & Delivery | Semantic Usage |
|---|---|---|
| **Familjen Grotesk** | Variable `.woff2` (400–700), self-hosted | Headings, UI labels, buttons, navigation items, cleaner category names, agent messages. |
| **JetBrains Mono** | Variable `.woff2` (400–600), self-hosted | Telemetry numbers, disk sizes, memory metrics, paths, package versions, hashes, logs. |

### 3.1 Type Scale

| Token | Size | Line Height | Weight | Family | Typical Usage |
|---|---|---|---|---|---|
| `display.lg` | 1.75rem (28px) | 1.20 | 700 | Familjen Grotesk | Health Score Hero, Page Titles ("Cleaner", "Dashboard") |
| `display.md` | 1.375rem (22px)| 1.25 | 700 | Familjen Grotesk | Section headers, Reclaimed storage counter ("4.2 GB") |
| `heading` | 1.125rem (18px)| 1.35 | 600 | Familjen Grotesk | Card headers, Drawer title, Modal headlines |
| `body-md` | 0.9375rem (15px)| 1.50 | 400 | Familjen Grotesk | Primary descriptions, agent chat dialogue, tool explanations |
| `body-sm` | 0.8125rem (13px)| 1.45 | 400 | Familjen Grotesk | Metadata, secondary rule notes, table headers |
| `label` | 0.75rem (12px) | 1.30 | 600 | Familjen Grotesk | Uppercase overline badges (`TIER 1`, `REVERSIBLE`, `FLATPAK`) |
| `mono-lg` | 1.375rem (22px)| 1.20 | 600 | JetBrains Mono | Live CPU/RAM percentages, Network transfer rates |
| `mono-md` | 0.9375rem (15px)| 1.30 | 500 | JetBrains Mono | Storage sizes (`312 GB / 512 GB`), PIDs, version diffs |
| `mono-sm` | 0.8125rem (13px)| 1.35 | 400 | JetBrains Mono | File paths, SHA-256 digests, terminal commands, D-Bus paths |

---

## 4. Spacing, Radii & Elevation

### 4.1 Spacing Scale (4px Base Grid)
`space.1 = 4px · space.2 = 8px · space.3 = 12px · space.4 = 16px · space.5 = 20px · space.6 = 24px · space.8 = 32px · space.10 = 40px`

### 4.2 Corner Radii
| Token | Value | Applied Elements |
|---|---|---|
| `r.xs` | 6px | Inline risk badges, status chips, code tags, source badges |
| `r.sm` | 10px | Buttons, inputs, search bar, dropdown selectors, tabs |
| `r.md` | 14px | Task Sheet step blocks, clean item rows, process table rows |
| `r.lg` | 20px | Glass cards, dashboard metric blocks, modal dialogs, agent drawer |
| `r.full` | 999px | Circular gauge rings, progress track ends, status indicator dots |

### 4.3 Glass Elevation & Shadows
- **Card Resting:** `box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12)`
- **Card Hover:** `box-shadow: 0 16px 45px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18)` (translates `translateY(-2px)`)
- **Modal / Floating Drawer:** `box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.20)`

---

## 5. Application Shell & Window Layout

The application utilizes a responsive desktop grid optimized for 1280×800 minimum resolution:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ [Titlebar]  [Brand Logo] Agentic Tuneup Pro   [Workspaces: Daily · Dev · Server]   [Search] │
├───────────────┬─────────────────────────────────────────────────────────────┬───────────────┤
│ [Sidebar]     │ [Main Content Area]                                         │ [Agent Drawer]│
│               │                                                             │               │
│ 📊 Dashboard  │  Good morning, User                                         │ 🤖 Agent      │
│ 🧹 Cleaner    │  Your system is running smoothly. 4.2 GB reclaimable.       │ local · llama │
│ 📦 Apps [12]  │ ┌──────────────┬──────────────┬──────────────┬────────────┐ │ ───────────── │
│ ⚙️ Processes  │ │ CPU: 24%     │ RAM: 6.2 GB  │ Disk: 312 GB │ Health: 88 │ │ Step Plan:    │
│ 🎛️ Settings   │ └──────────────┴──────────────┴──────────────┴────────────┘ │ 1. scan_junk  │
│               │ ┌─────────────────────────────┬───────────────────────────┐ │ 2. clean_junk │
│ ───────────── │ │ Live Telemetry (uPlot)      │ Top Resource Hogs         │ │ [ Approve ]   │
│ 🔒 Safety     │ └─────────────────────────────┴───────────────────────────┘ │ ───────────── │
│ Protected     │                                                             │ [Type or mic] │
└───────────────┴─────────────────────────────────────────────────────────────┴───────────────┘
```

### 5.1 Titlebar & Window Controls
- **Linux-Native Controls:** Avoid macOS traffic-light dots. Use clean, native-styled close, maximize, and minimize icons placed on the desktop environment's configured side (right for GNOME/KDE/Hyprland).
- **Workspace Presets:** Segmented pills (`Daily`, `Dev`, `Server`):
  - *Daily:* Focuses on browser caches, system temp, journal logs, and flatpak updates.
  - *Dev:* Activates scanners for `target/`, `node_modules/`, Docker containers, and orphan libraries.
  - *Server:* Focuses on systemd units, listening ports, orphan kernels, and journal disk pressure.
- **Universal Command Search (`Ctrl + K`):** Quick filter across installed applications, cleaner rules, processes, and natural language agent commands.

### 5.2 Navigation Sidebar
- Width: `210px` fixed (collapses to `64px` icon-only below `1024px` width).
- Active item uses Electric Cyan pill background with a glowing left bar: `linear-gradient(90deg, rgba(56, 189, 248, 0.20), transparent)`.
- Static safety seal at bottom: `🔒 Passwords & Keyrings are strictly protected and never touched.`

### 5.3 Collapsible Right-Side Agent Drawer (Replacing Floating Popups)
- Width: `380px` docked panel on the right edge.
- Toggleable via top-right robot icon or global shortcut (`Ctrl + Shift + A`).
- When open, it sits **alongside** the main content area (using CSS grid column resizing) so it never covers the data table or clean preview you are actively inspecting.
- Features:
  - Header with connection status (Local Ollama / Starship Bridge / Cloud API).
  - Streaming thought process (`signal.thinking` Amber wash).
  - Structured Task Sheet cards with inline `[Approve]` and `[Reject]` controls for Tier 2/3 gates.
  - Dictation button with live audio waveform animation (CPAL + Whisper).

---

## 6. Core Component Recipes

### 6.1 System Health Gauge Ring (`HealthGauge`)
- **Dimension:** 96×96px SVG ring gauge with circular progress stroke.
- **Background track:** `rgba(255, 255, 255, 0.10)`, stroke width: `8px`.
- **Value stroke:**
  - $85–100$: Emerald (`#10B981`)
  - $65–84$: Amber (`#F59E0B`)
  - $<65$: Rose (`#F43F5E`)
- **Center content:** `display.md` score number + small status badge below.
- **Spring motion:** Value stroke transitions smoothly over `800ms` with cubic bezier `cubic-bezier(0.22, 1, 0.36, 1)`.

### 6.2 Cleaner Rule Tree & Preview Card (`CleanCategoryCard`)
- **Category Header:** Icon + Category Name + Subtotal Size (`mono-md` in Cyan) + Select All Checkbox.
- **Expandable Tree View:** Clicking any category reveals itemized rule paths:
  - Matched file path: `mono-sm` with truncated prefix (`~/.cache/.../Cache/data_0`).
  - Size badge: Tabular numbers in `text.secondary`.
  - Risk pill: `REVERSIBLE` (Emerald outline) or `DESTRUCTIVE` (Rose outline).
  - "Why is this safe?" tooltip explaining the rationale (e.g. "Google Chrome automatically regenerates web cache upon visit").
- **Clean CTA Button:** Floating bar at top or bottom displaying total selected bytes:
  - Label: `Clean 4.2 GB to Quarantine`
  - On click: triggers animated progress ring and renders instant `[Undo]` button upon completion.

### 6.3 Package & App Row (`PackageRow`)
- **Grid Layout:** App Icon / Initials Avatar (36×36px, `r.sm`) → Name & Version (`body-md` + `mono-sm`) → Source Badge (`Flatpak`, `pacman`, `apt`) → Action Button.
- **Action Buttons:**
  - Updates: Cyan button labeled `Update (12.4 MB)`.
  - Installed: Subtle red-tinted button labeled `Uninstall`.
  - Orphans: Rose button labeled `Purge Orphan`.
- **Interactive Diff Drawer:** Clicking any package expands an inline drawer showing dependencies that will be added or removed, download size, and disk delta.

### 6.4 Process Table Row (`ProcessTableRow`)
- **Columns:** Process Name (`body-md` bold) · PID (`mono-sm`) · CPU Usage (`mono-md`) · Memory MB (`mono-md`) · Priority / Actions.
- **Resource Bar:** Tiny 6px progress bar beneath CPU and Memory columns showing relative percentage against total system capacity.
- **Signals:**
  - Priority: `Nice (+10)` button lowering process schedule priority.
  - Terminate: Red button labeled `Kill` (triggers Tier 3 confirmation modal explaining impact).

### 6.5 Starship Task Sheet Step Card (`PlanStepCard`)
When the AI agent proposes a multi-step maintenance plan, each step renders in a structured card:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Scan Package Caches                         [TIER 1]     │
│ Scans pacman and flatpak stores for unused runtimes         │
├─────────────────────────────────────────────────────────────┤
│ 2. Purge 4 Orphaned Packages (1.1 GB)          [TIER 3] ⚠️  │
│ Target: libgtk2.0-0, python3-distutils, org.gnome.Platform │
│ Diff: Frees 1.1 GB disk space · 0 reverse dependencies      │
│ [ ✓ Approve Removal ]    [ ✕ Reject Step ]                  │
└─────────────────────────────────────────────────────────────┘
```

- Tier 1 steps execute with an automatic Emerald checkmark.
- Tier 3 steps pause with an Amber/Rose pulsing boundary, displaying the exact dependency diff and requiring a click on `Approve Removal`.

---

## 7. Interactive States & Micro-interactions

| State | Visual Treatment |
|---|---|
| **Hover** | Surface shifts to `rgba(255, 255, 255, 0.09)`, subtle elevation lift `translateY(-2px)`, border brightens to `rgba(255, 255, 255, 0.22)`. |
| **Active / Pressed** | Scale down to `0.98`, inner shadow darkens. |
| **Focus Visible** | 2px solid Electric Cyan (`#38BDF8`) ring with 2px offset. Every interactive element is reachable via keyboard. |
| **Disabled** | Opacity drops to `0.40`, `cursor: not-allowed`, no hover transforms. |
| **Loading / Scanning**| Shimmer skeleton over numbers or pulsing Cyan/Amber indicator dot (`signal.thinking`). |
| **Error / Alert** | Rose wash (`rgba(244, 63, 94, 0.14)`), 1px solid Rose border, explanatory inline error message. |

---

## 8. Accessibility & Ergonomics (WCAG 2.2 AA)

1. **Color Contrast Floor:**
   - Primary text (`#F1F5F9`) on obsidian canvas (`#080B10`) exceeds **14:1** contrast ratio.
   - Secondary text (`rgba(241, 245, 249, 0.68)`) exceeds **7:1** contrast ratio.
   - Interactive Cyan controls (`#38BDF8`) exceed **4.5:1** contrast ratio against dark backgrounds.
2. **Keyboard Navigation:**
   - `Tab` / `Shift+Tab`: Sequential navigation across sidebar, tabs, cards, and buttons.
   - `Ctrl + K`: Opens universal command palette.
   - `Ctrl + Shift + A`: Toggles right-side Agent Drawer.
   - `Space` / `Enter`: Activates buttons, checkboxes, and toggles.
   - `Esc`: Closes modals, drawers, and cancels pending selections.
3. **Screen Readers & ARIA:**
   - All custom toggle switches include `role="switch"` and `aria-checked`.
   - Ring gauges include `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`.
   - Dynamic scanning updates announce via `aria-live="polite"` regions.

---

## 9. Performance & "Reduce Effects" Mode

On lower-powered Linux laptops, older GPUs, or setups without compositor blur (e.g. basic X11):

1. **Reduce Effects Toggle:** Accessible in Settings and auto-detected if frame rate drops below 40 fps:
   - Sets `--blur: 0px`.
   - Replaces translucent glass fills with solid dark obsidian tokens (`#0E131B`).
   - Suppresses backdrop filter calculations entirely, dropping GPU composite overhead to zero.
2. **WebKitGTK Rendering Floor:**
   - Zero continuously running SVG filter animations.
   - Sparklines render using HTML5 Canvas (`uPlot`) rather than hundreds of dynamic SVG DOM nodes.
   - Telemetry throttles from 1.0 Hz to 0.2 Hz when the window loses focus.

---

*Authored by Zvirox — Cyber Defender · Part of the Mother Ship Suite.*
