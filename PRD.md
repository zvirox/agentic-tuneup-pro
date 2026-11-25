# PRD — Agentic Tuneup Pro (ATP)

**Status:** Beta v0.1.0-beta.1 · **Owner:** zvirox · **Date:** 2026-11-25  
**Project:** Agentic Tuneup Pro (ATP)  
**Parent Ecosystem:** [Mother Ship / Starship Control](https://github.com/zvirox/starship-control)  
**Platform:** Linux (Wayland & X11) · **Tech Stack:** Rust 2024, Tauri 2, React 19, Tailwind CSS v4, Apache ECharts 6, SQLite  
**Authority:** Product Requirements Document governing ATP scope and engineering phases.

---

## 1. Overview & Vision

**Agentic Tuneup Pro (ATP)** is a safety-first Linux system cleaner, unified package manager, and live telemetry monitor built with a flat, solid Linear-style desktop interface. It combines declarative cache cleanup with an atomic SHA-256 quarantine store, multi-backend software visibility (`pacman`, `apt`, `dnf`, `flatpak`, `AppImage`), process tree and systemd service control, and Starship Control MCP automation.

ATP operates with a dual identity:
1. **Standalone Desktop Application:** High-contrast Linear matte desktop utility offering 1 Hz hardware telemetry, granular junk reclamation with one-click Undo, package and orphan inspection, process management, and an in-app agent cockpit drawer.
2. **Mother Ship / Starship Control Node:** Official MCP (Model Context Protocol) sub-application integrating with **Starship Control** over `$XDG_RUNTIME_DIR/starship/bridges/atp.sock` during GUI sessions and via headless stdio (`agentic-tuneup-pro --mcp`).

**Core Promise:** *"Inspect what is safe to clean, stage it reversibly to quarantine with zero shell risk, and keep credentials untouched."*

---

## 2. Core Product Goals & Non-Goals

### Product Goals
- **G1. Unified Single Binary:** Single Rust binary (`agentic-tuneup-pro`) running Tauri 2 GUI + Unix socket bridge by default, and headless JSON-RPC MCP stdio loop via `--mcp`.
- **G2. Quarantine-First Undo Engine:** Cleaned files stage atomically into `$XDG_DATA_HOME/agentic-tuneup-pro/quarantine/<session_id>/` with permissions, sizes, and SHA-256 manifests for sub-second Undo restore.
- **G3. Hard Protected System Boundary:** Hard-coded blacklist blocking browser password stores (`Login Data*`, `logins.json`, `key4.db`, `cert9.db`), identity keys (`~/.ssh`, `~/.gnupg`, `keyrings`), and whole-component OS roots (`/etc`, `/boot`, `/usr`, `/dev`, `/proc`, `/sys`).
- **G4. Multi-Backend Package Inspection & Managed Execution:** Query installed apps, updates, and orphan dependencies across **Flatpak, Native (`pacman`, `apt`, `dnf`), and AppImage**, routing privileged removals through `atpd-helper` D-Bus / Polkit. *(Note: D-Bus client execution bridge is currently pending completion in P0-4 / P1-A.)*
- **G5. Final Linear Matte Desktop UI (Locked):** Solid opaque surfaces in both Dark (`#050505` / `#111213`) and Light (`#F3F4F6` / `#FFFFFF`) themes using self-hosted `Inter`, `1px` borders, Apache ECharts telemetry, and zero blur/glass/glow overhead (`check:linear` gate enforced).
- **G6. Native Starship Control Integration:** Compliant with `starship-plugin` SDK (`SO_PEERCRED` UID validation, Tier 1/2/3 safety gates, canonical `CoreError` envelopes).
- **G7. Privileged Helper Isolation (`atpd-helper`):** Separate root D-Bus daemon governed by Polkit policy (`in.zvirox.agentic_tuneup.policy`) with strict regex whitelisting and zero `sh -c` calls.

### Non-Goals
- **N1. Non-Linux Operating Systems:** Engineered exclusively for Linux (Wayland primary, X11 supported). Windows and macOS are out of scope.
- **N2. Opaque Auto-Cleaners:** No blind file erasure. Every rule shows category, tier, reclaimable bytes, and sample target paths before staging.
- **N3. Telemetry & Cloud Accounts:** Zero analytics or phoning home. Local Ollama or optional private user keys only.
- **N4. Raw Shell Access:** Neither UI nor MCP agents can execute shell command strings.

---

## 3. Core Subsystems

### 3.1 Cleaner & Quarantine (`atp-cleaner`, `atp-safety`)
- **Rule Discovery:** Embedded core TOML rule suites (`system.toml`, `browsers.toml`, `package_caches.toml`, `dev_artifacts.toml`, `app_caches.toml`) plus user rules in `~/.config/agentic-tuneup-pro/rules/` and `/usr/share/agentic-tuneup-pro/rules/`.
- **Resilient Execution:** Automatically filters out rules locked by active applications (`requires_closed`) and skips inaccessible cache locks with audit notices instead of aborting the batch.
- **Audit Trail:** Local SQLite WAL ledger at `$XDG_DATA_HOME/agentic-tuneup-pro/audit.db` (`0600` permissions).

### 3.2 Package & Process Management (`atp-pkg`, `atp-procs`, `atpd-helper`)
- **Packages:** Live detection and inspection across Flatpak, native (`pacman`/`apt`/`dnf`), and AppImage (`PackageManagerManager`). Real D-Bus execution wiring via `atpd-helper` is tracked in Phase 5.
- **Processes & Services:** Live process grouping, tree signal termination (`SIGTERM` / `SIGKILL` with `pid > 1 && pid <= i32::MAX` bounds and critical-process guards), systemd unit control via `zbus`, and XDG autostart toggles.

### 3.3 Telemetry, Diagnostics & Snapshots (`atp-monitor`, `atp-safety`)
- **Telemetry:** 1.0 Hz sampling loop pushing CPU, memory, disk I/O, network throughput, and thermal readings via `evt://telemetry/tick`.
- **Health Score & Slowdown Diagnostics:** Algorithmic health calculation (`0–100`) and `"Why is my PC slow?"` multi-vector bottleneck advisor. *(Pending P1-C: wiring real scanned junk bytes and pending update totals into `HealthScore::calculate`; P0-8: category-scoping `clean_caches` remediation with preview.)*
- **Filesystem Snapshots:** Auto-detection and creation hooks for **Timeshift**, **Snapper**, and **Btrfs** subvolumes.

### 3.4 Agent Cockpit & Voice (`agent.rs`, `atp-voice`)
- **In-App Drawer:** Collapsible right-side cockpit drawer (`Ctrl + Shift + A`), `<system_data>` prompt-injection containment, and Task Sheet previews. *(Pending P0-5/P0-7/P1-D: backend-issued single-use cryptographic approval nonces, live scan delta calculation, real LLM tool-calling parsing, and keyring secret storage.)*
- **Voice Dictation:** Currently operates as a simulated **Voice Preview** workflow in UI; native `cpal` audio capture + `whisper-rs` (`ggml-base.en`) offline transcription is tracked in Phase 7.

---

## 4. Non-Functional & Packaging Requirements

- **Window & Accessibility:** 16:10 frameless window (`1280×800` default, `1024×640` minimum), keyboard shortcuts (`Ctrl+K`, `Ctrl+Shift+A`, `Alt+1..5`, `Esc`), `aria-live="polite"` announcer, `4.5:1` AA contrast in both Light and Dark themes.
- **UI Compliance:** Zero blur, zero translucency, zero dark shadows (`npm --prefix app run check:linear`).
- **Locked Distribution Formats:** Released exclusively via `packaging/nfpm.yaml` (`.deb`, `.rpm`, `.pkg.tar.zst` + `SHA256SUMS`) and container smoke tests. AppImage, Flatpak, tarballs, and AUR builds are permanently retired.

---

## 5. Implementation Status Matrix

| Phase | Scope | Codebase Status |
| :--- | :--- | :--- |
| **Phase 0** | Cargo workspace, Tauri 2 shell, **Locked Linear UI** | **Done** (`check:linear` + Vite build passing) |
| **Phase 1** | `atp-core` & `atp-safety` (Quarantine, Protected Paths, SQLite Audit) | **Done** (20 unit tests passing; P0-3 component boundary fixed) |
| **Phase 2** | `atpd-helper` daemon, `atp-monitor` telemetry, Health Score & Charts | **Done** (13 `atp-monitor` + 9 `atpd-helper` unit tests passing) |
| **Phase 3** | `atp-cleaner` parallel scanner, embedded rules, CategoryTree & Undo | **Done** (7 unit tests passing, async non-blocking IPC) |
| **Phase 4** | `atp-mcp` bridge (`SO_PEERCRED`, `--mcp` stdio, bounded `kill_process`) | **Done** (14 unit tests passing; P0-2 bounds & audit fixed) |
| **Phase 5** | `atp-pkg` & `atp-procs` | **Partial** (`atp-procs` complete; `atp-pkg` querying done, D-Bus execution pending P0-4/P1-A) |
| **Phase 6** | In-App Agent Drawer & Safety Gates | **Partial** (UI/drawer & prompt wrapping done; backend nonces P0-5, real LLM tool-calling P0-7/P1-D pending) |
| **Phase 7** | Diagnostics, Snapshots & Voice Dictation | **Partial** (Snapshot hooks & diagnostics done; category-scoped `clean_caches` P0-8 and `cpal`+`whisper-rs` P0-6/P1-D pending) |
| **Phase 8** | CI, Distro Packaging, Crate Docs & Release v1.0 | **In Progress** (CI & `nfpm` locked pipeline done; crate docs, evals, benchmarks, v1.0 pending) |

---

*Authored by Zvirox — Cyber Defender · Part of the Mother Ship Suite.*
