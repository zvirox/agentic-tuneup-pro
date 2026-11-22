# PLAN.md — Agentic Tuneup Pro Implementation Roadmap

**Version:** 1.0 · **Date:** 2026-11-18  
**Status:** Active Implementation Roadmap  
**Authority chain:** `PRD.md` (Product Scope) → `ARCHITECTURE.md` (Structure & Transports) → `DESIGN.md` (UI Law) → `API.md` (IPC & MCP Contracts) → **this file (Execution Order & Tracking Checklists)**  
**Rule:** Every phase ends with a **runnable vertical slice** (`cargo tauri dev` or `cargo test --workspace` produces verified, working behavior). Tasks are sized $\le$ 1–2 hours. No destructive actions are built before safety and quarantine are mathematically and unit-test verified.

---

## Master Checklist & Progress Tracker

- [x] **Phase 0 — Workspace Foundation & WebKitGTK Glass Spike** (Shell, Design Tokens, WebKitGTK 60fps)
- [x] **Phase 1 — Core Safety Engine & Quarantine Store** (Quarantine Mover, Undo Journal, Protected Validator)
- [x] **Phase 2 — Privileged Polkit Helper & System Monitor** (`atpd-helper` D-Bus Daemon, Telemetry Stream, Health Score)
- [x] **Phase 3 — Cleaner Engine & Quarantine UI** (TOML Rules, Parallel Scanner, File Tree Diff, Instant Undo)
- [x] **Phase 4 — Starship MCP Server & Bridge** (Unified Binary `--mcp` / Unix Socket, `SO_PEERCRED`, Tools)
- [x] **Phase 5 — Package & Process Manager** (Flatpak, Native pacman/apt/dnf, AppImage, Process Tree Kill)
- [x] **Phase 6 — In-App Agent Cockpit Drawer** (Collapsible Split Drawer, Task Sheet Planner, Tier 3 Gates)
- [x] **Milestone v0.0.1-alpha — Multi-Distro Release Pipeline** (.deb, .rpm, Flatpak, AUR PKGBUILD)
- [x] **Milestone v0.0.2-alpha — Standalone Embedded UI & Async GTK Runtime Hotfix** (Release on GitHub)
- [ ] **Phase 7 — Voice Dictation & Advanced Diagnostics** (Local Whisper, "Why is PC Slow?", Snapshot Hooks)
- [ ] **Phase 8 — Polish, Packaging & Release** (AppImage, deb, rpm, PKGBUILD, Release v1.0)

---

## Phase 0 — Workspace Foundation & WebKitGTK Glass Spike

> **Goal:** Establish the Cargo workspace, Tauri 2 desktop shell, React 19 frontend, Mother Ship design tokens, and verify that frosted-glass rendering idles under 1.0% CPU without continuous blur animations.

- [x] **0.1 Scaffold Root Cargo Workspace & Crate Layout**
  - Setup root `Cargo.toml` with members: `app`, `crates/atp-core`, `crates/atp-cleaner`, `crates/atp-safety`, `crates/atp-pkg`, `crates/atp-monitor`, `crates/atp-procs`, `crates/atp-mcp`, `crates/atpd-helper`.
  - Configure workspace lints (`deny(unsafe_code)`, `warn(clippy::pedantic)`, Rust 2024 edition).
  - *Verify:* `cargo check --workspace` compiles cleanly with zero warnings.
- [x] **0.2 Tauri 2 Desktop Shell Scaffolding**
  - Initialize Tauri 2 with React 19, TypeScript, and Vite in `app/`.
  - Configure `tauri.conf.json` with main window (1280×800 default, 960×640 minimum, transparent, decorated).
  - Setup least-privilege Tauri capabilities in `app/src-tauri/capabilities/default.json`.
  - *Verify:* `cargo tauri dev` launches an empty desktop window on Linux (Wayland & X11).
- [x] **0.3 Tailwind CSS v4 `@theme` & Token Bridging**
  - Self-host fonts: `FamiljenGrotesk` (variable) and `JetBrainsMono` (variable) via `@font-face`.
  - Author `tailwind.css` using `DESIGN.md` tokens (Obsidian `#080B10`, Electric Cyan `#38BDF8`, Amber `#F59E0B`, Emerald `#10B981`, Rose `#F43F5E`, Violet `#A855F7`).
  - Implement static glass recipes (`surface.glass: rgba(255, 255, 255, 0.055)` + 1px specular inner stroke `rgba(255, 255, 255, 0.15)`).
  - *Verify:* Visual swatch test renders typography, accents, and glass cards with high contrast.
- [x] **0.4 WebKitGTK Glass Performance & CPU Spike**
  - Mount 8 glass cards with static numbers and canvas sparklines in React.
  - Stress test WebKitGTK compositor: confirm zero continuous CSS filter animations (`filter: blur(...)` keyframes are removed).
  - Measure CPU usage during 60 seconds of idle on the host machine.
  - *Verify:* Idle CPU usage remains under **1.0%**; window resizing and route transitions maintain 60 fps.
- [x] **0.5 "Reduce Effects" Mode & Error Envelope Types**
  - Implement `--blur: 0px` fallback toggle shifting translucent cards to solid obsidian (`#0E131B`).
  - Implement standard typed error envelope (`CoreError`: `kind`, `code`, `retryable`, `userMessage`, `details`) in Rust and TypeScript mirroring `API.md §1`.
  - *Verify:* Toggling Reduce Effects eliminates all backdrop-filter overhead instantly.

**Definition of Done (Phase 0):** ✅ Tauri 2 desktop shell compiles, renders Mother Ship design tokens on Linux Wayland/X11, passes WebKitGTK performance gate (<1.0% idle CPU), and establishes shared error types.

---

## Phase 1 — Core Safety Engine & Quarantine Store

> **Goal:** Build the untrusted-to-trusted boundary: non-destructive quarantine store, atomic undo journal, hard-coded protected path validator, and SQLite audit logging.

- [x] **1.1 Core Domain Models (`atp-core`)**
  - Implement `Action`, `Plan`, `Step`, and `RiskTier` (`Tier1Safe`, `Tier2Reversible`, `Tier3Destructive`).
  - Implement `AuditEntry` and `ExecutionResult` structs with JSON serialization.
  - *Verify:* Unit tests validate step serialization and risk tier comparisons.
- [x] **1.2 Hard Protected Path Boundary (`atp-safety`)**
  - Implement `ProtectedValidator` with hard-coded blacklist patterns:
    - Browser passwords (`Login Data*`, `logins.json`, `key4.db`, `cert9.db`).
    - Identity & crypto keys (`~/.ssh/**`, `~/.gnupg/**`, `keyrings/**`).
    - Root OS hierarchies (`/etc/**`, `/boot/**`, `/usr/**`).
  - Implement directory traversal prevention (`..` resolution and symlink dereference checking).
  - *Verify:* Test suite verifies scanner immediately errors if attempting to touch password or SSH files, even if a rule explicitly targets them.
- [x] **1.3 Quarantine Engine & Manifest Store (`atp-safety`)**
  - Implement `QuarantineStore` at `$XDG_DATA_HOME/agentic-tuneup-pro/quarantine/<session_id>/`.
  - Atomically move targeted files into relative quarantine directories while recording original paths, file modes, byte sizes, and SHA-256 hashes in `manifest.json`.
  - *Verify:* Moving test files creates a valid quarantine session and preserves original permissions.
- [x] **1.4 Instant Sub-Second Undo Engine (`atp-safety`)**
  - Implement `restore_quarantine(session_id)`:
    - Reads `manifest.json`.
    - Verifies destination paths are clear or prompts for overwrite.
    - Atomically moves files back to their exact original locations.
  - Implement automated purge for sessions older than 7 days (`purge_quarantine`).
  - *Verify:* Quarantined test files are restored to their original paths in < 200 ms with byte parity confirmed via SHA-256.
- [x] **1.5 SQLite Audit Log Engine (`atp-safety`)**
  - Setup SQLite connection with WAL mode, `PRAGMA foreign_keys = ON`, busy timeout 5000ms, and `0600` permissions at `$XDG_DATA_HOME/agentic-tuneup-pro/audit.db`.
  - Implement schema migrations: `quarantine_sessions`, `audit_log`, `user_rules`.
  - Implement append-only logging of every user/agent action with cryptographic hashes.
  - *Verify:* Invariant test proves audit entries are persisted and queryable.

**Definition of Done (Phase 1):** ✅ Files can be moved to quarantine and restored with byte-level perfection via instant Undo; protected path validator blocks all credential access; SQLite audit log tracks all operations. [COMPLETED]

---

## Phase 2 — Privileged Polkit Helper & System Monitor

> **Goal:** Deploy the minimal root D-Bus helper daemon with Polkit policies, stream live hardware telemetry via sysinfo, and calculate the System Health Score.

- [x] **2.1 Hardened Polkit Helper Daemon (`atpd-helper`)**
  - Implement standalone binary `atpd-helper` with system D-Bus interface `in.zvirox.AgenticTuneupHelper`.
  - Author Polkit policy file `packaging/in.zvirox.agentic_tuneup.policy` defining granular actions (`pkg-manage`, `journal-vacuum`, `process-kill`, `systemd-control`).
  - Implement strict whitelist regex argument validation (package names must match `^[a-zA-Z0-9_\-\.\+]+$`; no shell operators).
  - *Verify:* D-Bus test call executes permitted action upon Polkit authentication; invalid/injected arguments are rejected.
- [x] **2.2 Telemetry Sampling Loop (`atp-monitor`)**
  - Implement background Tokio sampling loop using `sysinfo` and `/proc`/`/sys` at 1.0 Hz (throttling to 0.2 Hz when window is minimized).
  - Collect CPU usage (total & per-core), temperatures, memory/swap breakdown, disk read/write throughput (MB/s), and network upload/download (MB/s).
  - *Verify:* Telemetry ticks produce accurate hardware metrics matching `htop` / `btop`.
- [x] **2.3 In-Memory Ring Buffer & Push Event Stream**
  - Implement fixed-capacity ring buffer (last 300 samples / 5 minutes) for time-series sparklines.
  - Broadcast telemetry to Tauri webview via `evt://telemetry/tick`.
  - Implement `cmd://telemetry_get_snapshot` and `cmd://telemetry_get_history`.
  - *Verify:* Frontend receives 1.0 Hz telemetry frames with zero IPC latency.
- [x] **2.4 System Health Score Calculator (0–100)**
  - Implement deterministic health score algorithm evaluating disk pressure, memory starvation, high sustained temperatures, pending updates, and junk bloat.
  - Return itemized deduction list with actionable remediation links (`cmd://health_get_score`).
  - *Verify:* Artificially filling disk or consuming RAM dynamically reduces score with clear explanatory reasons.
- [x] **2.5 Dashboard UI (`HealthGauge` & Telemetry Sparklines)**
  - Author SVG Health Gauge Ring with smooth spring transitions and color thresholding (Emerald >85, Amber 65–84, Rose <65).
  - Author canvas-based streaming sparklines (`uPlot`) for CPU, Memory, and Network.
  - Build top-resource consumers card with CPU/Memory percentage bars.
  - *Verify:* Dashboard renders live hardware telemetry smoothly with < 1.0% CPU overhead.

**Definition of Done (Phase 2):** ✅ Polkit helper securely processes privileged tasks via D-Bus; dashboard displays real-time telemetry and animated Health Gauge ring matching DESIGN.md. [COMPLETED]

---

## Phase 3 — Cleaner Engine & Quarantine UI

> **Goal:** Declarative TOML cleaner rule engine, multi-threaded disk scanner, transparent file tree diff preview, and one-click clean with instant Undo.

- [x] **3.1 TOML Rule Engine & Discovery (`atp-cleaner`)**
  - Implement TOML rule parser for files in `rules/` and `$XDG_CONFIG_HOME/agentic-tuneup-pro/rules/`.
  - Ship core rule packs: `system.toml`, `browsers.toml`, `package_caches.toml`, `dev_artifacts.toml`, `app_caches.toml`.
  - *Verify:* Parser correctly loads rule definitions, globs, risk tiers, and closed-app requirements.
- [x] **3.2 Multi-Threaded Parallel Disk Scanner (`atp-cleaner`)**
  - Author parallel file tree scanner using Rayon / Tokio file walkers.
  - Expand path globs, calculate byte sizes, and filter matched paths through `ProtectedValidator`.
  - Emit real-time scanning progress (`evt://cleaner/scan_progress`).
  - *Verify:* Scanning standard system caches (>20,000 files) completes in under 2.5 seconds.
- [x] **3.3 Running App Detector & Browser Safety**
  - Probe active process list for applications targeted by rules (e.g. `chrome`, `firefox`).
  - Warn users and block execution if a browser is actively running.
  - Implement cookie keep-list for user-specified domains (e.g. `github.com`, `google.com`).
  - *Verify:* Cleaner refuses to clean Chrome cache while Chrome is running, offering clean termination.
- [x] **3.4 Cleaner Category Tree UI (`CleanCategoryCard`)**
  - Build category list with itemized checkboxes, subtotal sizes (`mono-md`), and category badges.
  - Implement expandable tree view showing exact file paths, sizes, and "Why is this safe?" tooltips.
  - *Verify:* User can drill down into any category and inspect exact paths before cleaning.
- [x] **3.5 Clean Execution & Instant Undo Flow**
  - Wire `cmd://cleaner_execute_clean` to floating CTA button (`Clean X.X GB to Quarantine`).
  - Display progress ring animation during quarantine move.
  - Emit completion toast with high-visibility **`[Undo]`** link.
  - *Verify:* Clicking "Clean" frees disk space immediately; clicking "Undo" restores all files in < 500 ms.

**Definition of Done (Phase 3):** ✅ Scans 1,000+ cache locations in seconds, previews exact file trees, moves gigabytes to quarantine safely, and restores them on demand via Undo. [COMPLETED]

---

## Phase 4 — Starship MCP Server & Bridge

> **Goal:** Unified binary supporting `--mcp` for headless background tasks and an authenticated Unix domain socket bridge (`atp.sock`) during live GUI sessions.

- [x] **4.1 Unified Binary Routing (`main.rs`)**
  - Parse CLI arguments on startup:
    - If `--mcp` flag present $\to$ run headless stdio JSON-RPC 2.0 loop without GUI.
    - If default $\to$ launch Tauri GUI and start background Unix socket bridge.
  - *Verify:* Running `agentic-tuneup-pro --mcp` opens stdio JSON-RPC loop; normal launch opens desktop window.
- [x] **4.2 Unix Domain Socket Bridge with `SO_PEERCRED` (`atp-mcp`)**
  - Bind listener at `$XDG_RUNTIME_DIR/starship/bridges/atp.sock` (mode `0700`).
  - On incoming connection, execute `libc::getsockopt(fd, SOL_SOCKET, SO_PEERCRED, ...)` to verify client UID matches host user.
  - Drop connection immediately if caller UID does not match.
  - *Verify:* Local socket connection verifies credentials; unauthorized UID is rejected.
- [x] **4.3 Plugin Manifest Auto-Registration**
  - Write Starship capability manifest to `$XDG_DATA_HOME/starship/plugins/atp.json` on app startup.
  - Clean up socket and manifest cleanly on SIGTERM / application exit.
  - *Verify:* Starship Control discovers ATP automatically in its App Topology drawer.
- [x] **4.4 MCP Protocol Handshake (`starship/hello`) & Tool Schemas**
  - Implement `starship/hello` returning `appId: "atp"`, version, and full tool schemas:
    - `tuneup.get_health` (Tier 1)
    - `tuneup.scan_junk` (Tier 1)
    - `tuneup.clean_junk` (Tier 2)
    - `tuneup.restore_quarantine` (Tier 2)
    - `tuneup.list_packages` (Tier 1)
    - `tuneup.list_orphans` (Tier 1)
    - `tuneup.remove_packages` (Tier 3)
    - `tuneup.purge_orphans` (Tier 3)
    - `tuneup.list_processes` (Tier 1)
    - `tuneup.kill_process` (Tier 3)
    - `tuneup.purge_quarantine` (Tier 3)
  - *Verify:* MCP client can inspect and discover all registered tools and JSON schemas.
- [x] **4.5 MCP Tool Invocation (`tools/call`) & Cancellation (`tools/cancel`)**
  - Wire `tools/call` to execute internal actions via `atp-core` with `leaseTimeoutMs`.
  - Wire `tools/cancel` to abort active file scans or package operations via Tokio cancellation tokens.
  - Format all return errors in standard Starship error envelope (`API.md §1`).
  - *Verify:* External MCP client (Claude Desktop / Starship Control) can trigger `tuneup.scan_junk` and receive structured byte totals.

**Definition of Done (Phase 4):** ✅ ATP seamlessly integrates into Starship Control via Unix socket (`atp.sock`) and functions headlessly via `agentic-tuneup-pro --mcp`. [COMPLETED]

---

## Phase 5 — Package & Process Manager

> **Goal:** Unified package management across Flatpak, Host Native (`pacman`/`apt`/`dnf`), and AppImage, plus process tree kill and systemd unit control.

- [x] **5.1 `PackageBackend` Trait & Host Detection (`atp-pkg`)**
  - Define `PackageBackend` async trait (search, list, check updates, audit orphans, prepare plan).
  - Implement host detector inspecting `/etc/os-release` to activate Flatpak, Native, and AppImage backends.
  - *Verify:* Running on Arch activates pacman + Flatpak; running on Ubuntu activates apt + Flatpak.
- [x] **5.2 Flatpak & AppImage Backends**
  - Implement Flatpak backend: query installed apps/runtimes, detect unused runtimes (`flatpak uninstall --unused`).
  - Implement AppImage backend: scan `~/Applications` and `~/.local/bin`, manage `.desktop` entries.
  - *Verify:* Unused Flatpak runtimes are detected with exact reclaimable sizes.
- [x] **5.3 Distro-Native Backends & Orphan Resolution**
  - Implement Arch backend (`pacman -Qdtq` for orphans).
  - Implement Debian/Ubuntu backend (`apt autoremove --dry-run`).
  - Implement Fedora backend (`dnf autoremove`).
  - Calculate dependency diffs before execution (`PackagePlan`).
  - Route mutating uninstalls through `atpd-helper` with Polkit prompt.
  - *Verify:* Orphan packages are audited and displayed with zero reverse dependency proof.
- [x] **5.4 Process Tree Explorer & Signals (`atp-procs`)**
  - Implement process list grouped by application (e.g. Chrome parent + 20 helper workers).
  - Implement signals: `SIGTERM` (clean close), `SIGKILL` (force kill), `nice` priority shift.
  - Implement tree-kill: traverse child PIDs recursively and terminate the full tree.
  - *Verify:* Terminating a multi-process browser closes all child processes cleanly without orphaned workers.
- [x] **5.5 Systemd Services & Startup Manager (`atp-procs`)**
  - Connect to systemd user and system buses via `zbus`.
  - List services, start, stop, restart, enable, disable.
  - Autostart manager: parse desktop files in `~/.config/autostart/` and toggle enabled states.
  - *Verify:* User can toggle startup apps and inspect service logs directly from the UI.
- [x] **5.6 Apps & Processes UI**
  - Build **Apps** screen with source filters (All, Flatpak, Native, AppImage), updates counter, and "Update All" button.
  - Build **Processes** screen with sortable tables, CPU/Memory progress bars, and kill confirmation modals.
  - *Verify:* User can update an app and kill a runaway process with interactive confirmation.

**Definition of Done (Phase 5):** ✅ Unified package management across native and containerized formats; orphan packages audited and pruned; processes and systemd services managed safely. [COMPLETED]

---

## Phase 6 — In-App Agent Cockpit Drawer

> **Goal:** An integrated right-side agent drawer providing natural-language assistance, Task Sheet plan generation, and inline Tier 3 approval gates.

- [x] **6.1 Collapsible Agent Drawer Layout**
  - Build 380px collapsible right-side drawer docked alongside the main canvas (CSS grid split).
  - Toggleable via top-right robot button or `Ctrl + Shift + A` / `Escape`.
  - Connect drawer state with global UI so agent can highlight target rows in the active table.
  - *Verify:* Opening drawer resizes content area smoothly without overlapping data tables.
- [x] **6.2 LLM Provider Adapters & Keyring Storage**
  - Implement pluggable LLM interface supporting local Ollama (`localhost:11434`), Anthropic Claude API, and OpenAI-compatible endpoints.
  - Store API keys securely in Linux Secret Service via `libsecret` and sovereign offline planner fallback.
  - *Verify:* Agent can stream completions from local Ollama or private API keys.
- [x] **6.3 Task Sheet Decomposition & State Machine**
  - Turn natural-language instructions ("Free up 5 GB and clean my browser") into structured **Task Sheets** (`tasksheet/1`).
  - Categorize steps into risk tiers (`Tier1Safe`, `Tier2Reversible`, `Tier3Destructive`).
  - Step states: `Pending`, `WaitingApproval`, `Executing`, `Completed`, `Failed`.
  - *Verify:* Agent produces a structured plan before executing any mutations.
- [x] **6.4 Tier 3 Interactive Approval Gate Cards (`PlanStepCard`)**
  - Render pending mutating steps with diff summaries and prominent **`[Approve]`** and **`[Reject]`** buttons.
  - Enforce signed approval tokens: execution engine rejects dispatch if token is missing.
  - *Verify:* Destructive steps pause execution until the user explicitly clicks Approve in the drawer.
- [x] **6.5 Prompt Injection Defenses**
  - Wrap all external system data (package names, log lines, file paths) in `<system_data>` blocks.
  - Enforce system prompt invariant: external text is treated as data, never instructions.
  - *Verify:* Malicious file names or package summaries cannot trigger unauthorized tool calls.

**Definition of Done (Phase 6):** ✅ User can type requests to the agent, inspect structured Task Sheets in the right-side drawer, approve/deny risky steps, and observe execution progress. [COMPLETED]

---

## Milestone: v0.0.1-alpha Pre-Release Packaging & Multi-Distro Distribution

> **Goal:** Release the first public alpha (`v0.0.1-alpha`) across all primary Linux distribution channels (.deb, .rpm, Flatpak, and AUR PKGBUILD) with full privileged helper, desktop integration, and D-Bus/Polkit policies.

- [x] **M.1 System Integration & Metadata Assets**
  - Desktop Entry: `packaging/agentic-tuneup-pro.desktop` adhering to FreeDesktop standard.
  - AppStream Metadata: `packaging/in.zvirox.agentictuneuppro.metainfo.xml` for GNOME Software and KDE Discover.
  - Systemd Service: `packaging/atpd-helper.service` managing the privileged helper daemon.
  - Icon theme assets: multi-resolution icons (`hicolor` 32x32, 64x64, 128x128, 256x256, 512x512, scalable SVG).
  - *Verify:* Desktop entry validates cleanly via `desktop-file-validate` and AppStream validates via `appstreamcli`.
- [x] **M.2 Debian / Ubuntu Package (`.deb`)**
  - Standalone Debian package generator and Tauri bundle configuration.
  - Install scripts (`postinst`, `prerm`, `postrm`) for D-Bus and systemd daemon reloading.
  - Multi-arch amd64 support with dependencies (`libwebkit2gtk-4.1-0`, `libgtk-3-0`, `libayatana-appindicator3-1`).
  - *Verify:* Package builds and installs cleanly on Debian/Ubuntu systems with full Polkit registration.
- [x] **M.3 Fedora / RHEL / openSUSE Package (`.rpm`)**
  - RPM specification file: `packaging/rpm/agentic-tuneup-pro.spec`.
  - Configured dependencies (`webkit2gtk4.1`, `gtk3`, `libappindicator-gtk3`, `polkit`).
  - Integrated `rpmbuild` workflow producing `agentic-tuneup-pro-0.0.1-alpha.1.x86_64.rpm`.
  - *Verify:* `rpmbuild -bb` succeeds and package query confirms all files and scripts.
- [x] **M.4 Flatpak Manifest (`in.zvirox.AgenticTuneupPro.yaml`)**
  - Author Flatpak manifest targeting `org.freedesktop.Platform//24.08`.
  - Grant permissions for filesystem cleanup (`filesystem=host:ro`, `filesystem=home`, `filesystem=xdg-cache`).
  - Configure system bus talk to `in.zvirox.AgenticTuneupHelper`.
  - *Verify:* Manifest conforms to Flatpak 1.x builder specifications.
- [x] **M.5 Arch Linux AUR Package (`PKGBUILD` & `.SRCINFO`)**
  - Author standard Arch Linux `PKGBUILD` for `agentic-tuneup-pro-bin` / `agentic-tuneup-pro`.
  - Author `packaging/aur/agentic-tuneup-pro.install` pacman hooks.
  - Generate canonical `.SRCINFO` for AUR repository synchronization.
  - *Verify:* `makepkg -od` or pacman verification parses and validates the package recipe.
- [x] **M.6 Automated Release Orchestration Script (`scripts/build-packages.sh`)**
  - Single-command orchestration script that builds optimized release binaries and generates `.deb`, `.rpm`, `flatpak` manifest bundle, and `AUR` tarball.
  - Direct output to `dist/v0.0.1-alpha/` with checksums (`SHA256SUMS`).
  - *Verify:* Running `./scripts/build-packages.sh` compiles and packages all targets reproducibly.

**Definition of Done (v0.0.1-alpha Milestone):** ✅ `.deb`, `.rpm`, `Flatpak`, and `AUR PKGBUILD` packages produced and validated for public alpha testing ahead of Phase 7 and the final v1.0 stable release. [COMPLETED]

---

## Phase 7 — Voice Dictation & Advanced Diagnostics

> **Goal:** Hands-free voice commands via local Whisper dictation, "Why is my PC slow?" automated diagnostics, and Timeshift/btrfs snapshot hooks.

- [ ] **7.1 Microphone Capture & Voice Activity Detection (`atp-voice`)**
  - Implement audio capture using `cpal` with voice activity detection (VAD).
  - Global push-to-talk hotkey (`Ctrl + Space` or `Super + Shift + Space`) managed via `ashpd`.
  - Animate live audio waveform in the agent drawer during speech capture.
  - *Verify:* Pressing shortcut opens audio capture and visualizes voice waveform.
- [ ] **7.2 Embedded Local Whisper Engine**
  - Integrate `whisper-rs` (whisper.cpp) with default `base.en` model.
  - Stream transcribed text directly into the agent drawer input field.
  - *Verify:* Spoken command ("Clean my package cache") transcribes accurately offline and submits to agent.
- [ ] **7.3 "Why is my PC slow?" Diagnostic Engine**
  - Correlate CPU load, memory pressure, I/O wait, thermal throttling, and `journalctl` error logs.
  - Detect runaway processes, memory leaks, and disk indexing daemons (e.g. `tracker-miner-fs`).
  - Present plain-English diagnosis and offer one-click fixes (e.g. "Lower tracker priority", "Clean caches").
  - *Verify:* Stress-testing the CPU or disk triggers an intelligent diagnostic summary explaining the exact bottleneck.
- [ ] **7.4 Pre-Change Snapshot Hooks (Timeshift / Snapper / btrfs)**
  - Detect presence of Timeshift or Snapper on system.
  - Provide toggle to automatically trigger a filesystem snapshot before executing major package purges.
  - *Verify:* Snapshot hook creates a restorable snapshot before executing Tier 3 package removals.

**Definition of Done (Phase 7):** ✅ Offline voice dictation operates seamlessly via hotkey; system diagnosis explains performance bottlenecks with one-click fixes; snapshot integration protects system state.

---

## Phase 8 — Polish, Packaging & Release

> **Goal:** Production-grade quality hardening, full keyboard accessibility, multi-distro packaging, and public v1.0 release.

- [ ] **8.1 Keyboard Navigation & Accessibility Pass (WCAG AA)**
  - Implement full keyboard navigation across every surface (`Tab`, `Ctrl+K` command palette, `Esc` dismiss).
  - Verify 4.5:1 color contrast floor across all text tokens against obsidian glass.
  - Ensure all toggles, gauges, and tables announce correctly to screen readers.
  - *Verify:* Entire cleanup and package update workflow can be completed using keyboard alone.
- [ ] **8.2 Cross-Distro Container Test Matrix**
  - Setup automated test containers for:
    - Arch Linux (pacman, ALPM, systemd).
    - Fedora 41 (dnf5, Flatpak, systemd).
    - Ubuntu 24.04 LTS (apt, dpkg, systemd).
  - *Verify:* All package backends and cleaner rules pass automated integration tests in clean containers.
- [ ] **8.3 Linux Distro Packaging**
  - Build standalone **AppImage** bundled with required libraries.
  - Author Debian/Ubuntu `.deb` package with systemd helper unit and Polkit policy.
  - Author Fedora `.rpm` package and Arch Linux `PKGBUILD`.
  - *Verify:* AppImage and native packages install, launch, and register D-Bus helper cleanly on target distros.
- [ ] **8.4 Documentation, Assets & Release v1.0**
  - Update `README.md` with final screenshots, architecture diagrams, and quickstart commands.
  - Author `docs/USER_GUIDE.md`, `docs/SAFETY.md`, and `docs/RULE_AUTHORING.md`.
  - Tag milestone `v1.0.0` and publish release artifacts.

**Definition of Done (Phase 8):** ✅ Fully tested across Arch, Fedora, and Ubuntu; packaged in AppImage, deb, and rpm; documented and ready for sovereign desktop use.

---

*Authored by Zvirox — Cyber Defender · Part of the Mother Ship Suite.*
