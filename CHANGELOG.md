# Changelog

All notable changes to **Agentic Tuneup Pro** are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)  
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

## [0.1.0-beta.3] - 2026-11-26

### Changed
- **Shared Linear Palette & Cyan Primary (`DESIGN.md` v2.1, `AGENTS.md`)**: Migrated color system to shared Charcoal/Graphite dark (`#1C1C1C` / `#292929`) and light (`#F8F9FA` / `#FFFFFF`) tokens (`app/src/styles/linear-theme.css`) paired with Agentic Tuneup Pro's Cyan primary accent (`app/src/styles/app-accent.css`: `--primary` `#06B6D4` dark / `#0E7490` light) and `.shadow-card` card elevation.
- **Zero Green / Role-Based Tokens**: Removed all `--green`, `--teal`, green hues, and legacy `--tint-*` / `--accent` tokens across components; healthy, online, positive delta, done, and Safety Boundary states now use `--sky`, `--sky-text`, and `--chip-sky`.
- **Runtime ECharts CSS Variable Theme**: Updated `app/src/components/linear/echarts-linear-theme.ts` and `TuneupTelemetryChart.tsx` to resolve colors dynamically from `getComputedStyle(document.documentElement)` on live `data-theme` switches (CPU `--primary`, Memory `--orange`, Disk `--purple`) with zero hex literals in chart code.
- **Hardened `check:linear` Gate**: Updated `app/scripts/check-linear.mjs` to enforce token-file isolation, SHA-256 sync for `linear-theme.css`, exact `app-accent.css` parity, retired hex & foreign-primary bans, green-hue (`75°–170°`) bans, and `var(--shadow-card)`-only shadows.

## [0.1.0-beta.2] - 2026-11-25

### Changed
- **Locked Final Linear UI Standard (`DESIGN.md` v2.0, `AGENTS.md`)**: Finalized flat solid matte Dark (`#050505` / `#111213`) and Light (`#F3F4F6` / `#FFFFFF`) palettes with precomputed solid surface tints (`--tint-*`), self-hosted `@fontsource/inter`, `1280×800` (`min 1024×640`) frameless window geometry, `40px` `TitleBar` reading version from `tauri.conf.json`, collapsible `240px/56px` `Sidebar` with workspace switcher, `Breadcrumb`, `StatCard` sparklines, `DonutLegend`, `ProgressRow`, `RangeTabs`, `DataTable`, `StatusPill`, and `LinearDialog`.
- **Strict `check:linear` Gate**: Expanded `app/scripts/check-linear.mjs` to fail on any blur, translucency (`rgba()`, `/10`, `bg-white/*`), dark-mode shadow, legacy glass class, or off-token raw hex color.
- **Honest UI & Preview Handling**: Replaced fake 800 ms package confirmation timer in `AppsView` with an honest preview notice pending `atpd-helper` D-Bus wiring; labeled voice controls as `Preview`; updated `safeInvoke` to propagate real Tauri errors and wrapped all preview IPC helpers cleanly.

### Fixed
- Component-aware system root validation in `atp-safety` (`ProtectedValidator`) so `/dev` no longer blocks `/developer`.
- Strict PID bounds (`pid > 1 && pid <= i32::MAX`) and SQLite audit logging on `atp-mcp` `tuneup.kill_process`.

---

## [0.1.0-beta.1] - 2026-11-24

### Added
- **Real-Time Visualizations**: Integrated Apache ECharts 6 telemetry charts.
- **Mother Ship & Starship Control Integration**: `starship-plugin` SDK integration with automatic bridge registration and discovery.
- **Native Packaging & CI**: Unified `nfpm` generation producing Debian (`.deb`), Fedora/RHEL (`.rpm`), and Arch Linux (`.pkg.tar.zst`) packages alongside `SHA256SUMS` and `.github/workflows/ci.yml`.
