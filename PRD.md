# PRD — Agentic Tuneup Pro (ATP)

**Status:** Draft v0.1 · **Owner:** zvirox · **Date:** 2026-11-18  
**Project:** Agentic Tuneup Pro (ATP)  
**Parent Ecosystem:** [Mother Ship / Starship Control](https://github.com/zvirox/starship-control)  
**Platform:** Linux (Wayland & X11) · **Tech Stack:** Rust 2024, Tauri 2, React 19, Tailwind CSS v4, SQLite  
**Authority:** Root Product Requirements Document governing ATP design, architecture, and implementation.

---

## 1. Overview & Vision

**Agentic Tuneup Pro (ATP)** is an agentic, glass-UI system cleaner, package manager, and performance tune-up suite for Linux. It combines the deep cleaning capabilities of BleachBit, the unified multi-source software management of UniGetUI (WingetUI), the process and service insights of `htop` and Stacer, and an autonomous AI agent controllable by text and voice.

ATP operates with a dual identity:
1. **Standalone Desktop Application:** An autonomous, high-performance desktop utility offering real-time system telemetry, granular junk reclamation with an instant undo quarantine engine, cross-distro package management, and an in-app agent companion drawer.
2. **Mother Ship / Starship Control Node:** An official MCP (Model Context Protocol) sub-application that natively integrates with **Starship Control** via Unix Domain Sockets (`$XDG_RUNTIME_DIR/starship/bridges/atp.sock`) during live GUI sessions, and via headless stdio CLI (`agentic-tuneup-pro --mcp`) for non-interactive maintenance pipelines.

**Core Promise:** *"Tell your Linux what you want. It shows you what it will do, then does it — and can always undo it."*

**One-Line Pitch:** *The sovereign, agentic system cleaner and package manager for Linux — safe by default, explainable, and fully orchestrated.*

---

## 2. Problem Statement

Maintaining a healthy, clean, and fast Linux workstation is currently fragmented, manual, and risky:

1. **Fragmented Tooling:** Users bounce between CLI tools and isolated GUIs: BleachBit for cache/temp removal, `apt`/`dnf`/`pacman` for native packages, `flatpak` and `snap` CLIs for containerized apps, `htop`/`btop` for processes, and `journalctl`/`systemctl` for daemon troubleshooting.
2. **Lack of Safe Undo (Destructive Anxiety):** Standard Linux cleaners invoke irreversible `rm -rf` operations. Accidental deletion of browser profile databases, extension configurations, or dev environment data leads to catastrophic state loss.
3. **Orphan Bloat & Leftover Decay:** Package managers leave behind unused runtimes (Flatpak), old kernels, and orphaned libraries that quietly consume tens of gigabytes of disk space without obvious visibility.
4. **Isolated Desktop Agents:** Generic AI assistants (Claude Code, Cursor, ChatGPT) lack native awareness of Linux package managers, systemd user services, and desktop sandboxes, and cannot safely verify root boundaries.
5. **Slow, Resource-Heavy Desktop Frontends:** Many modern system utilities built on Electron consume hundreds of megabytes of RAM and induce high idle CPU usage when rendering complex blurred interfaces under Linux compositors.

---

## 3. Target Users & Personas

### Persona 1: "The Linux Power User & Developer" (Primary)
- **Profile:** Software engineer working on modern Linux distributions (Fedora, Arch Linux, Ubuntu, Debian). Frequently builds Rust, Node.js, Python, and C++ projects; uses Docker, Podman, Flatpaks, and native packages.
- **Pain Points:** Stale `target/` and `node_modules/` folders hiding across disk; multiple package managers cluttering disk caches; runaway development processes (e.g. stalled language servers, rogue build daemons).
- **Success Criteria:** ATP scans developer directories and package caches, calculates reclaimable storage in under 3 seconds, displays an exact tree diff, and frees 20+ GB to quarantine with a single click or prompt.

### Persona 2: "The Everyday Desktop User"
- **Profile:** Non-technical or intermediate Linux desktop user (Ubuntu, Fedora Workstation, Linux Mint). Prefers a visually polished, intuitive GUI.
- **Pain Points:** Frightening terminal commands (`sudo apt autoremove`, `journalctl --vacuum-size`); fear of breaking system stability or losing browser logins.
- **Success Criteria:** A clean, frosted-glass dashboard displaying a human-readable **System Health Score (0–100)** with one-click "Smart Scan & Clean" that guarantees passwords and keyrings are never touched.

### Persona 3: "The Starship Control Mission Orchestrator" (Agent Persona)
- **Profile:** Autonomous agent running within **Starship Control** executing multi-app automation workflows.
- **Goal:** Connects to ATP via Unix Domain Socket (`atp.sock`) or headless stdio (`--mcp`) to inspect storage pressure, clean temporary media files generated during EEP video renders, or purge orphaned dependencies before capturing large screen takes in SSP.
- **Success Criteria:** Sub-millisecond JSON-RPC tool response times, deterministic tool execution, standard error envelopes, and zero unexpected popups for Tier 1 tasks.

---

## 4. Goals & Non-Goals

### Product Goals (MVP)
- **G1. Unified Single Binary:** A single Rust binary (`agentic-tuneup-pro`) that runs the full Tauri 2 GUI by default, runs headless MCP via `--mcp`, and serves the Starship Control bridge socket whenever the GUI is active.
- **G2. Quarantine-First Undo Engine:** Cleaned files are atomically staged into a versioned quarantine store (`$XDG_DATA_HOME/agentic-tuneup-pro/quarantine/<timestamp>/`) with full restore metadata before permanent deletion.
- **G3. Protected System Boundary (Hard Invariant):** Hard-coded, non-overridable blacklist preventing modification or deletion of browser credentials (`Login Data`, `logins.json`, `key4.db`), SSH keys (`~/.ssh`), GPG keys (`~/.gnupg`), system keyrings, and core root hierarchies (`/etc`, `/usr`, `/boot`).
- **G4. Multi-Backend Package Management:** Unified search, update, install, and orphan pruning across **Flatpak, Host Native (`pacman`, `apt`, `dnf`), and AppImage**.
- **G5. High-Performance Glass UI on Linux:** Frosted-glass desktop interface built with Tailwind CSS v4, React 19, and Radix primitives optimized for WebKitGTK under Wayland and X11 (idles under 1% CPU with static glass tokens and zero continuous background blur animations).
- **G6. Native Starship Control Integration:** Full compliance with the `starship-plugin` SDK, including Unix domain socket communication, `SO_PEERCRED` UID authentication, Tier 1/2/3 safety arbitration, and standard error envelopes.
- **G7. Hardened Privileged Helper:** Separation of unprivileged GUI/agent from root operations via a dedicated Polkit D-Bus helper daemon (`atpd-helper`). No shell string execution (`sh -c`) anywhere in the application.

### Non-Goals (MVP)
- **N1. Non-Linux Operating Systems:** ATP is engineered exclusively for Linux (Wayland primary, X11 supported). Windows and macOS are strictly out of scope.
- **N2. Blind "Registry-Style" Magic Cleaners:** No black-box optimizations. Every single rule, file path, and package action is transparently previewed, explained, and logged.
- **N3. Cloud Accounts, Analytics & Telemetry:** Zero telemetry, no phoning home, no cloud logins. Model queries connect directly to local Ollama/GGUF or private user API keys.
- **N4. Raw Shell Access for Agents:** The AI agent (in-app or via Starship) can only invoke strongly-typed Rust tools registered in the core registry.

---

## 5. Mother Ship Ecosystem & Starship Control Integration Map

ATP fits directly into the Mother Ship application suite alongside Easy Edits Pro, ScreenStudio Pro, Audio Labs Pro, and Net Watch Pro:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        STARSHIP CONTROL TOPOLOGY                       │
└────────────────────────────────────────────────────────────────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     │ Unix Sockets ($XDG_RUNTIME_DIR/starship/bridges/*.sock) │
     ▼                           ▼                           ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────────┐
│  EASY EDITS PRO  │    │ SCREENSTUDIO PRO │    │  AGENTIC TUNEUP PRO      │
│  (Video Editor)  │    │ (Screen Recorder)│    │  (System Cleaner & Pkg)  │
│  `eep.sock`      │    │ `ssp.sock`       │    │  `atp.sock` / `--mcp`    │
└──────────────────┘    └──────────────────┘    └─────────────┬────────────┘
                                                              │
                                        ┌─────────────────────┴────────────┐
                                        │ ATP Internal Subsystems          │
                                        ├──────────────────────────────────┤
                                        │ • atp-cleaner  (Quarantine Store)│
                                        │ • atp-pkg      (Native + Flatpak)│
                                        │ • atp-monitor  (sysinfo telemetry│
                                        │ • atp-safety   (Audit & Boundary)│
                                        │ • atpd-helper  (Polkit D-Bus Root│
                                        └──────────────────────────────────┘
```

### Protocol & Discovery Contracts
1. **Manifest File:** `$XDG_DATA_HOME/starship/plugins/atp.json`
2. **GUI Bridge Socket:** `$XDG_RUNTIME_DIR/starship/bridges/atp.sock` (created on app startup, removed on clean shutdown).
3. **Authentication:** Linux kernel `SO_PEERCRED` check verifies caller UID matches current user process before accepting any JSON-RPC request.
4. **Headless Spawning:** If Starship Control triggers ATP while offline, it executes `agentic-tuneup-pro --mcp` over standard I/O.

---

## 6. Core Functional Requirements

### 6.1 Cleaner Engine (`atp-cleaner`)
- **Rule Engine:** TOML-based declarative rules stored in `rules/` and `$XDG_CONFIG_HOME/agentic-tuneup-pro/rules/`.
- **Predefined Rule Packs:**
  - *System:* `/tmp` (files older than 7 days), thumbnails (`~/.cache/thumbnails/`), trash (`~/.local/share/Trash`), systemd journal trimming (`--vacuum-size=200M`), crash dumps.
  - *Package Caches:* `apt` archives, `dnf` cache, `pacman` cached packages (`paccache -rk2`), Flatpak unused runtimes (`flatpak uninstall --unused`).
  - *Application Caches:* Electron apps, Slack, Discord, Spotify, VS Code/Cursor caches, IDE index files.
  - *Browsers (Chrome, Firefox, Brave, Edge, Opera):* Cache, cookies, history, session state, local storage. **Hard protected:** strictly omits `Login Data`, `logins.json`, `key4.db`, extensions, and bookmarks. Requires browser process termination prior to clean.
  - *Developer Artifacts:* Stale `node_modules/` (unmodified > 60 days), Rust `target/` directories, Python `__pycache__` and `.venv`, Docker dangling images and build cache.
- **Quarantine & Undo System (`atp-safety`):**
  - All file removals (Tier 2 Reversible) move files into `$XDG_DATA_HOME/agentic-tuneup-pro/quarantine/<timestamp>/`.
  - Manifest file (`manifest.json`) preserves original absolute paths, permissions, and directory structures.
  - "Undo" command restores files to exact original paths in sub-second time.
  - Automated purge after configurable retention period (default: 7 days).

### 6.2 Package & App Manager (`atp-pkg`)
- **Abstract Backend Architecture:** Unified `PackageBackend` trait providing search, list installed, check updates, install, remove, and orphan audit.
- **Initial Backends:**
  1. *Flatpak:* Search Flathub, list installed apps/runtimes, update apps, remove unused dependencies.
  2. *Distro Native:* Auto-detected based on `/etc/os-release`:
     - Arch Linux: `pacman` + `alpm` bindings (orphans via `pacman -Qdtq`).
     - Debian / Ubuntu: `apt` (orphans via `apt autoremove --dry-run`).
     - Fedora: `dnf5` / `dnf` (orphans via `dnf autoremove`).
  3. *AppImage:* Discovers standalone binaries in `~/Applications` and `~/.local/bin`, extracts icons, manages desktop entries, and deletes cleanly.
- **Orphan Auditor:** Highlights packages installed as dependencies that are no longer required by any explicitly installed software.
- **Diff Preview:** Every install or remove action renders a precise dependency impact list before execution.

### 6.3 System Health & Telemetry Engine (`atp-monitor`)
- **Real-Time Sampling:** High-throughput, low-overhead sampling loop using `sysinfo` and `/proc`/`/sys` monitoring:
  - CPU usage (aggregate and per-core), temperatures, frequency.
  - RAM and Swap allocation, buffer/cache accounting.
  - Disk read/write throughput (MB/s) and root/home capacity.
  - Network throughput (download/upload MB/s) per active network interface.
  - GPU load and VRAM (best-effort via `nvml`, `amdgpu`, and DRM sysfs).
- **System Health Score (0–100):** Weighted algorithmic calculation factoring in storage exhaustion, memory pressure, active zombies/runaway processes, pending system updates, and accumulative junk size.
- **Process & Service Control (`atp-procs`):**
  - Live process explorer with instant search, tree grouping, CPU/memory sorting.
  - Process signals: `SIGTERM` (clean termination), `SIGKILL` (force kill), `nice` priority adjustment.
  - Kill process tree: safely kills parent process and all spawned child workers.
  - Systemd User & System Units via `zbus` D-Bus: list services, start, stop, restart, enable, disable.
  - Autostart Manager: manage desktop autostart entries (`~/.config/autostart/`).

### 6.4 Hardened Privileged Helper (`atpd-helper`)
- Dedicated, minimal root daemon communicating over system D-Bus with a registered Polkit policy (`in.zvirox.agentic_tuneup.policy`).
- Exposes only fixed, strongly-typed operations:
  - `PackageRemove(backend: String, packages: Vec<String>)`
  - `PackageCleanCache(backend: String)`
  - `JournalVacuum(size_mb: u64)`
  - `KillProcess(pid: u32, signal: i32)`
  - `SystemdUnitAction(unit: String, action: String)`
- All parameters undergo strict whitelist regex validation. No arbitrary string interpolation or shell commands.

### 6.5 Starship MCP Toolset & In-App Agent
ATP registers the following canonical tools over MCP and the internal agent planner:

| Tool Identifier | Risk Tier | Description |
|---|---|---|
| `tuneup.get_health` | **Tier 1 (Safe)** | Returns System Health score (0–100), telemetry summary, and disk status. |
| `tuneup.scan_junk` | **Tier 1 (Safe)** | Scans disk against all active rule packs and returns itemized reclaimable bytes. |
| `tuneup.list_packages` | **Tier 1 (Safe)** | Lists installed packages and available updates across backends. |
| `tuneup.list_orphans` | **Tier 1 (Safe)** | Identifies unused dependencies and unused Flatpak runtimes. |
| `tuneup.list_processes` | **Tier 1 (Safe)** | Lists running processes filtered by resource consumption. |
| `tuneup.clean_junk` | **Tier 2 (Mutating)** | Moves specified rule targets into the quarantine store. Generates undo ID. |
| `tuneup.restore_quarantine` | **Tier 2 (Mutating)** | Restores quarantined files from a specific session ID back to original paths. |
| `tuneup.disable_startup` | **Tier 2 (Mutating)** | Disables an autostart desktop entry or systemd user unit. |
| `tuneup.remove_packages` | **Tier 3 (Destructive)** | Removes specified packages via Polkit helper after user approval. |
| `tuneup.purge_orphans` | **Tier 3 (Destructive)** | Purges orphaned dependencies and unused runtimes after user approval. |
| `tuneup.kill_process` | **Tier 3 (Destructive)** | Terminates a process or process tree after user approval. |
| `tuneup.purge_quarantine` | **Tier 3 (Destructive)** | Permanently deletes quarantined files from disk. |

---

## 7. Technical Architecture & Tech Stack

```
agentic-tuneup-pro/
├── Cargo.toml                       # Workspace root
├── PRD.md                           # This document (Product Requirements)
├── ARCHITECTURE.md                  # System architecture & process boundaries
├── DESIGN.md                        # Mother Ship visual design system tokens
├── API.md                           # IPC commands, MCP schemas & error envelopes
├── PLAN.md                          # Implementation roadmap & phase gates
├── app/                             # Tauri 2 Desktop Frontend
│   ├── src-tauri/                   # Tauri IPC glue, bridge socket, windowing
│   └── src/                         # React 19, TypeScript, Tailwind CSS v4, Radix
├── crates/
│   ├── atp-core/                    # Shared types: Action, RiskTier, Plan, Result, Audit
│   ├── atp-cleaner/                 # Rule engine, file scanner, quarantine mover
│   ├── atp-pkg/                     # PackageBackend trait, flatpak, native (apt/dnf/pacman)
│   ├── atp-monitor/                 # sysinfo telemetry, health score, ring buffer
│   ├── atp-procs/                   # Process tree inspector, zbus systemd client
│   ├── atp-safety/                  # Protected paths validator, quarantine store, SQLite audit
│   ├── atp-mcp/                     # Starship JSON-RPC 2.0 protocol, socket & stdio listener
│   └── atpd-helper/                 # Minimal root D-Bus daemon with Polkit policies
└── rules/                           # Default TOML cleaner rule files
```

| Component | Technology | Rationale |
|---|---|---|
| **App Shell** | **Tauri 2** | Small binary (~15MB), low memory footprint, native Wayland/X11 support. |
| **Frontend** | **React 19 + TypeScript + Vite** | Fast reactive UI, typed schemas mirrored from Rust IPC. |
| **Styling** | **Tailwind CSS v4** | Pure CSS `@theme` tokens matching Mother Ship `DESIGN.md`. |
| **Design System** | **Familjen Grotesk + JetBrains Mono** | Cross-app visual harmony with Easy Edits Pro and ScreenStudio Pro. |
| **Core Logic** | **Rust 2024 + Tokio** | Memory safety, zero-cost abstractions, multi-threaded disk scanning. |
| **System Telemetry** | **`sysinfo` + Linux `/proc`/`/sys`** | Fast cross-distro hardware and process inspection. |
| **D-Bus & Polkit** | **`zbus` (pure Rust)** | Async D-Bus client for systemd and root helper communication. |
| **Audit & State DB** | **SQLite 3 (`rusqlite`)** | WAL mode, `0600` permissions, local transaction-safe audit logging. |
| **Protocol** | **MCP JSON-RPC 2.0** | Native compatibility with Starship Control and external coding agents. |

---

## 8. Safety Model & Invariants

ATP enforces safety through compiler-checked boundaries rather than relying on LLM prompt instructions:

1. **Strict Three-Tier Risk Model:**
   - *Tier 1 (Safe / Autonomous):* Read-only operations. Auto-approved.
   - *Tier 2 (Mutating / Reversible):* Moves files to quarantine. Reversible via one-click Undo.
   - *Tier 3 (Destructive / Privileged):* Permanent deletions, package uninstalls, process kills. Requires explicit human signature token from UI or Starship HUD.
2. **Hard Protected List (Non-Overridable):**
   - The scanner and quarantine engine will hard-error if any rule or agent request targets:
     - Browser passwords: `Login Data`, `logins.json`, `key4.db`.
     - SSH/GPG credentials: `~/.ssh/**`, `~/.gnupg/**`.
     - System keyrings and crypto wallets.
     - Root system directories: `/etc/**`, `/boot/**`, `/usr/**` (except via package manager backend).
3. **Quarantine Before Delete:**
   - Permanent deletion is impossible on the first pass; files must exist in quarantine first.
4. **Append-Only SQLite Audit Trail:**
   - Every single mutation (tool, target path/package, initiator: `user` or `agent`, timestamp, outcome) is recorded to `$XDG_DATA_HOME/agentic-tuneup-pro/audit.db` with strict `0600` permissions.
5. **No Shell Invocations:**
   - All backend executions use direct `std::process::Command::new(binary).args(...)` with validated argument vectors. Free-form string evaluation (`sh -c`) is strictly forbidden.

---

## 9. Non-Functional Requirements

- **Performance on Linux (WebKitGTK):**
  - Idle CPU usage must remain below **1.0%** on modern multi-core systems.
  - Idle RAM consumption must stay under **90 MB** for the desktop app.
  - No continuous background blur re-renders or unbounded CSS animations.
- **Cold Startup Time:** Desktop interface ready and rendering live telemetry in under **400 ms**.
- **Scan Throughput:** Scans standard system caches and package stores (> 20,000 files) in under **2.5 seconds** using parallel Tokio/rayon workers.
- **Reliability:** Background daemon crashes or socket disconnects must never corrupt the quarantine store or audit log.
- **Accessibility:** Full keyboard navigability (`Tab`, arrow navigation, `Ctrl+K` command palette, `Esc` modal dismiss) with WCAG AA color contrast ratios across all frosted-glass surfaces.

---

## 10. Delivery Phases & Milestones

Following **Approach 1 (Safety-First Foundation)**:

| Milestone | Scope | Deliverables & Done When |
|---|---|---|
| **Phase 0** | Workspace Scaffolding & Glass Spike | Workspace crates created; Tauri 2 + React 19 + Tailwind v4 shell; Mother Ship design tokens; WebKitGTK 60fps validation with 0% idle CPU. |
| **Phase 1** | Safety Engine & Quarantine Store | `atp-core` and `atp-safety` crates; quarantine mover; undo journal; protected paths validator; SQLite audit log. Unit tests confirm password files are immune. |
| **Phase 2** | Privileged Polkit Helper & System Monitor | `atpd-helper` D-Bus daemon with Polkit policies; `atp-monitor` streaming sysinfo telemetry to UI via Tauri events; System Health score (0–100). |
| **Phase 3** | Cleaner Engine & UI Preview | `atp-cleaner` TOML rule engine; parallel scanner; interactive file tree preview; one-click clean to quarantine and sub-second Undo. |
| **Phase 4** | Starship MCP Server & Bridge | Unified binary handling GUI bridge socket (`$XDG_RUNTIME_DIR/starship/bridges/atp.sock`) with `SO_PEERCRED` and headless stdio (`--mcp`); Tier 1/2/3 tool schemas. |
| **Phase 5** | Package & Process Manager | `atp-pkg` (Flatpak + native `pacman`/`apt`/`dnf` + AppImage); orphan dependency auditor; `atp-procs` process tree kill and systemd unit control. |
| **Phase 6** | In-App Agent Cockpit Drawer | Collapsible right-side agent drawer; local Ollama and Anthropic API adapters; plan preview cards matching Starship Control task sheets. |
| **Phase 7** | Voice Dictation & Advanced Diagnostics | Local Whisper dictation via global shortcut (`Ctrl+Space`); "Why is my PC slow?" system diagnosis; Timeshift/btrfs snapshot hooks. |
| **Phase 8** | Packaging, Polishing & Release | Locked `nfpm` packaging (`.deb`, `.rpm`, `.pkg.tar.zst` via `zvirox/release-workflows`), container smoke tests, documentation; release v1.0. (AppImage, Flatpak, AUR, and VM tests retired.) |

---

*Authored by Zvirox — Cyber Defender · Part of the Mother Ship Suite.*
