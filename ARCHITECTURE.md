# ARCHITECTURE.md — Agentic Tuneup Pro (ATP)

**Version:** 1.0 · **Date:** 2026-11-18  
**Status:** Planning & Architecture Phase  
**Authority chain:** `PRD.md` (Product Requirements) → **this file (System Architecture, Contracts & Boundaries)** → `DESIGN.md` (UI Law) → `API.md` (IPC & MCP Contracts) → `PLAN.md` (Roadmap)  
**Rule:** Defines technical structure, process boundaries, crate layout, protocols, safety invariants, and data flows. No product code is written as part of this document.

---

## 1. Architecture Principles

1. **Single Binary, Dual Operation:**
   A single, self-contained Rust binary (`agentic-tuneup-pro`) handles both visual desktop operation and headless automation. When invoked with `--mcp`, it runs headless over stdio as an MCP server. When invoked normally, it launches the Tauri 2 desktop GUI and simultaneously establishes the Starship Control Unix domain socket bridge. Both modes share the exact same underlying core crates, business logic, safety gates, and quarantine stores.
2. **Mother Ship Ecosystem First-Class Node:**
   ATP is natively designed to integrate into the **Mother Ship** ecosystem. During active desktop sessions, it publishes its manifest to `$XDG_DATA_HOME/starship/plugins/atp.json` and listens on an authenticated Unix domain socket at `$XDG_RUNTIME_DIR/starship/bridges/atp.sock`. Connections are verified via Linux kernel `SO_PEERCRED` checks to ensure callers share the same UID.
3. **Quarantine-First Non-Destructive Mutations:**
   Permanent deletions on first-pass cleanup are strictly prohibited. All cleaning actions move targeted directories and files into a versioned, transactional quarantine store (`$XDG_DATA_HOME/agentic-tuneup-pro/quarantine/<timestamp>/`). Every operation generates a structured manifest recording original absolute paths, permissions, and checksums, guaranteeing instant, atomic Undo.
4. **Hardened Root Separation (Zero Shell Invocations):**
   The user-facing GUI and agent run unprivileged as the desktop user. Privileged system mutations (e.g. `apt remove`, `dnf autoremove`, `pacman -R`, systemd unit control) communicate exclusively with a minimal, audited root D-Bus daemon (`atpd-helper`) guarded by fine-grained Polkit authorization policies. All arguments are whitelisted and validated against strict schemas; raw shell string evaluation (`sh -c`) is completely banned.
5. **Hardware-Respectful Glass UI on Linux:**
   Tauri on Linux renders via **WebKitGTK**. To guarantee 60 fps fluid animations and idle CPU consumption below **1.0%**, the interface avoids CPU-heavy continuous background blur animations. Surface glass uses hardware-accelerated static glass tokens, 1px specular inner borders, high-contrast obsidian backgrounds, and CSS transforms/opacity transitions only.
6. **SQLite Single Source of Truth for State & Audits:**
   All quarantine sessions, scheduled cleaning jobs, user whitelists, and immutable audit logs are persisted in a local SQLite database (`audit.db`) using Write-Ahead Logging (WAL) and strict `0600` filesystem permissions.

---

## 2. Tech Stack Specification

| Layer | Choice | Rationale |
|---|---|---|
| **App Shell** | **Tauri 2** | Small binary footprint (~15 MB), native Wayland/X11 support, low memory consumption (<90 MB idle). |
| **Frontend Framework** | **React 19 + TypeScript + Vite** | Strict end-to-end typing mirroring Rust IPC structs; fast Vite HMR loop. |
| **Styling & Tokens** | **Tailwind CSS v4** | Pure CSS `@theme` tokens harmonized with Mother Ship `DESIGN.md`. |
| **Component Primitives** | **Radix UI + Lucide Icons** | Accessible, unstyled, keyboard-operable components customized with glass tokens. |
| **Motion & Physics** | **Motion (`framer-motion`)** | Smooth spring animations for drawer expansion, card reveals, and status transitions. Suppressed on `prefers-reduced-motion`. |
| **Live Telemetry Charts** | **uPlot + Recharts** | High-performance, canvas-based streaming time-series charts with microsecond render times. |
| **Core Async Runtime** | **Rust 2024 + Tokio** | High-concurrency async runtime managing telemetry sampling, D-Bus IPC, and MCP streams. |
| **System Telemetry** | **`sysinfo` + `/proc` / `/sys`** | Low-overhead cross-distro hardware metrics, memory accounting, and process tree inspection. |
| **D-Bus & Systemd** | **`zbus` (Pure Rust)** | Async D-Bus client for systemd unit control, session management, and Polkit helper communication. |
| **Privilege Separation** | **Polkit + Custom D-Bus Daemon** | Fine-grained root authorization without `sudo` shell escapes. |
| **Storage & Audit Trail** | **SQLite 3 (`rusqlite`)** | Embedded, ACID-compliant local database in WAL mode with `PRAGMA foreign_keys = ON;`. |
| **Agent Protocol** | **Model Context Protocol (MCP)** | Official JSON-RPC 2.0 protocol powering both the in-app agent and Starship Control orchestration. |
| **Local LLM Engine** | **Pluggable (Ollama / Starship)** | Direct connection to local Ollama endpoints or delegation to Starship Control's `starship-infer` engine. |

---

## 3. System Topology & Process Boundaries

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AGENTIC TUNEUP PRO TOPOLOGY                     │
└────────────────────────────────────────────────────────────────────────┘

 [ USER INTERFACE (Tauri 2 Webview / WebKitGTK) ]
   ┌──────────────────────────────────────────────────────────────────┐
   │                       MAIN DESKTOP WINDOW                        │
   │  Dashboard · Cleaner Preview · Apps · Processes · Settings       │
   │  [ Collapsible Right-Side Agent Drawer: Chat & Plan Verification]│
   └──────────────────────────────────┬───────────────────────────────┘
                                      │ Tauri IPC (`invoke` / `emit`)
                                      ▼
 [ ATP UNIFIED CORE PROCESS (`agentic-tuneup-pro` - User Privileges) ]
   ┌──────────────────────────────────────────────────────────────────┐
   │                         CORE ORCHESTRATOR                        │
   │   Task Planner · Safety Arbiter · Quarantine Journal · State     │
   └──────┬─────────────────────┬─────────────────────┬───────────────┘
          │                     │                     │
          ▼                     ▼                     ▼
   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
   │ atp-cleaner  │      │   atp-pkg    │      │ atp-monitor  │
   │ Rule Engine  │      │ Multi-Backend│      │ sysinfo loop │
   │ File Scanner │      │ Flatpak/Arch/│      │ Health Score │
   │ Quarantine   │      │ Debian/Fedora│      │ Process Tree │
   └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                │
                                ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │                      STARSHIP MCP BRIDGE (`atp-mcp`)             │
   │  • Mode A: Unix Domain Socket: $XDG_RUNTIME_DIR/.../atp.sock      │
   │    (SO_PEERCRED Authenticated, Live GUI Active)                  │
   │  • Mode B: Headless stdio Child Process (`--mcp`)                │
   │  • Handshake: `starship/hello`, `tools/list`, `tools/call`       │
   └────────────────────────────┬─────────────────────────────────────┘
                                │
                                │ System D-Bus (`zbus`)
                                ▼
 [ PRIVILEGED BOUNDARY (Root Helper Daemon) ]
   ┌──────────────────────────────────────────────────────────────────┐
   │                         atpd-helper                              │
   │  Dedicated minimal root binary · System D-Bus Service            │
   │  Polkit Policy: `in.zvirox.agentic-tuneup.policy`                │
   │  Operations: PurgeOrphans, RemovePackages, VacuumJournal, Kill   │
   │  Zero raw shell execution · Strict regex argument whitelist      │
   └──────────────────────────────────────────────────────────────────┘
```

---

## 4. Crate & Workspace Layout

The project is structured as a modular Cargo workspace isolating safety, rules, package engines, and protocols:

```
agentic-tuneup-pro/
├── Cargo.toml                       # Cargo workspace root
├── PRD.md                           # Product requirements source of truth
├── ARCHITECTURE.md                  # This document
├── DESIGN.md                        # Mother Ship visual design system tokens
├── API.md                           # IPC commands, MCP schemas & wire protocol
├── PLAN.md                          # Implementation roadmap & phase gates
├── AGENTS.md                        # Agent invariants & contributor rules
├── README.md
├── LICENSE
├── rules/                           # Default TOML cleaner rule files
│   ├── system.toml                  # Temp files, logs, journal, crash dumps
│   ├── browsers.toml                # Chrome, Firefox, Brave, Edge caches
│   ├── package_caches.toml          # apt, pacman, dnf, flatpak caches
│   ├── dev_artifacts.toml           # node_modules, target, venv, docker
│   └── app_caches.toml              # Electron, Discord, Slack, Spotify
├── packaging/                       # Linux packaging scripts (AppImage, deb, rpm, PKGBUILD)
├── app/                             # Tauri 2 Desktop Application
│   ├── Cargo.toml
│   ├── tauri.conf.json              # Window settings, permissions, Wayland flags
│   ├── capabilities/                # Tauri least-privilege capability manifests
│   ├── src-tauri/
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs              # Unified entrypoint (inspects --mcp vs GUI)
│   │   │   ├── ipc/                 # Tauri commands (cleaner, apps, stats, agent)
│   │   │   ├── bridge.rs            # Starship Unix domain socket server
│   │   │   └── menu.rs              # System tray & window controls
│   └── src/                         # Frontend (React 19 + TypeScript + Vite)
│       ├── App.tsx                  # Shell layout (Sidebar + Main + Agent Drawer)
│       ├── components/
│       │   ├── dashboard/           # Gauge rings, sparklines, health breakdown
│       │   ├── cleaner/             # Category list, path tree diff, clean button
│       │   ├── apps/                # Unified package list, update-all, orphans
│       │   ├── processes/           # Process table, kill confirmation, services
│       │   ├── agent/               # Collapsible chat drawer, tool plan cards
│       │   └── common/              # Glass panels, buttons, toggles, modals
│       ├── hooks/                   # useTelemetry, useCleaner, usePackages
│       ├── stores/                  # Zustand state stores
│       └── tailwind.css             # Tailwind v4 @theme tokens
└── crates/
    ├── atp-core/                    # Shared types, error definitions, risk tiers
    │   ├── src/
    │   │   ├── lib.rs
    │   │   ├── action.rs            # Action, Plan, Step, RiskTier (1/2/3)
    │   │   ├── error.rs             # Standard error envelope (Starship format)
    │   │   └── result.rs            # Execution results & diff summary
    ├── atp-cleaner/                 # Cleaner rule engine & scanner
    │   ├── src/
    │   │   ├── lib.rs
    │   │   ├── rule.rs              # TOML rule deserializer & path expander
    │   │   ├── scanner.rs           # Multi-threaded file tree walker
    │   │   └── executor.rs          # Atomic quarantine mover
    ├── atp-safety/                  # Safety validation & rollback journal
    │   ├── src/
    │   │   ├── lib.rs
    │   │   ├── protected.rs         # Hard-coded protected path validator
    │   │   ├── quarantine.rs        # Quarantine store & restore engine
    │   │   └── audit.rs             # SQLite audit trail recorder
    ├── atp-pkg/                     # Unified package manager backends
    │   ├── src/
    │   │   ├── lib.rs
    │   │   ├── backend.rs           # PackageBackend trait
    │   │   ├── flatpak.rs           # Flatpak CLI / libflatpak integration
    │   │   ├── native/              # Host-detected native engines
    │   │   │   ├── arch.rs          # pacman & ALPM orphan query
    │   │   │   ├── debian.rs        # apt & dpkg backend
    │   │   │   └── fedora.rs        # dnf5 / dnf backend
    │   │   └── appimage.rs          # AppImage scanner & desktop integrator
    ├── atp-monitor/                 # System telemetry & process metrics
    │   ├── src/
    │   │   ├── lib.rs
    │   │   ├── sampler.rs           # sysinfo background sampling loop
    │   │   ├── health.rs            # Health score (0-100) calculator
    │   │   └── ring.rs              # In-memory time-series ring buffer
    ├── atp-procs/                   # Process tree & systemd services
    │   ├── src/
    │   │   ├── lib.rs
    │   │   ├── process.rs           # Process tree discovery & signals
    │   │   ├── systemd.rs           # zbus systemd manager
    │   │   └── autostart.rs         # Desktop autostart entry parser
    ├── atp-mcp/                     # Starship MCP protocol implementation
    │   ├── src/
    │   │   ├── lib.rs
    │   │   ├── protocol.rs          # JSON-RPC 2.0 frames & handshake
    │   │   ├── server.rs            # Unix socket & stdio listener
    │   │   ├── security.rs          # SO_PEERCRED UID validator
    │   │   └── tools/               # Typed MCP tool handlers
    └── atpd-helper/                 # Root Polkit D-Bus daemon
        ├── Cargo.toml
        └── src/
            ├── main.rs              # System D-Bus daemon entrypoint
            ├── service.rs           # D-Bus method handler
            └── validator.rs         # Strict regex argument validation
```

---

## 5. Cleaner & Quarantine Subsystem

```
                         Scan Triggered (UI or Agent)
                                      │
                                      ▼
                        Load Active TOML Rule Packs
                                      │
                                      ▼
                  Expand Globs & Walk File Hierarchy (Rayon)
                                      │
                                      ▼
                  Filter Against Protected Path Validator
             (Drop passwords, keyrings, SSH, GPG, /etc, /usr)
                                      │
                                      ▼
                   Return Scan Result & Exact File Diff
                                      │
                        User / Agent Triggers "Clean"
                                      │
                                      ▼
                     Generate Timestamped Quarantine ID
              $XDG_DATA_HOME/agentic-tuneup-pro/quarantine/<ID>/
                                      │
                                      ▼
                       Atomically Move Targeted Files
                       (Create directories & move nodes)
                                      │
                                      ▼
                         Write `manifest.json` & Log
                  (Original paths, sizes, hashes, timestamp)
                                      │
                                      ▼
                    Available for Instant Undo (7 Days)
```

### 5.1 Hard Protected Path Boundary (Non-Overridable)
Before any file node is touched by the scanner or quarantine executor, it is passed through the `ProtectedValidator`. If any rule or agent instruction matches any of the following patterns, execution immediately aborts with a `safety.protected_path_violation` error:

- **Browser Credential Stores:**
  - `**/google-chrome/**/Login Data*`
  - `**/chromium/**/Login Data*`
  - `**/BraveSoftware/**/Login Data*`
  - `**/microsoft-edge/**/Login Data*`
  - `**/.mozilla/firefox/**/logins.json`
  - `**/.mozilla/firefox/**/key4.db`
  - `**/.mozilla/firefox/**/cert9.db`
- **Identity & Cryptographic Secrets:**
  - `~/.ssh/**`
  - `~/.gnupg/**`
  - `~/.local/share/keyrings/**`
  - `~/.pki/**`
- **System Operating System Trees:**
  - `/etc/**`
  - `/boot/**`
  - `/usr/**` (except via package backend uninstall)
  - `/var/lib/**` (except standard package caches)

### 5.2 Quarantine Store & Manifest Format
Each clean session is recorded in its own isolated directory:
`$XDG_DATA_HOME/agentic-tuneup-pro/quarantine/<session_id>/`

Containing the moved files in an internal relative hierarchy plus a `manifest.json`:

```json
{
  "sessionId": "q_20261118_104500_8f3a",
  "createdAt": "2026-11-18T10:45:00Z",
  "expiresAt": "2026-11-25T10:45:00Z",
  "initiator": "user",
  "ruleIds": ["chrome-cache", "system-tmp", "stale-node-modules"],
  "totalBytesReclaimed": 4509715660,
  "fileCount": 1420,
  "files": [
    {
      "originalPath": "/home/zvirox/.cache/google-chrome/Default/Cache/data_0",
      "quarantineRelativePath": "files/0001_data_0",
      "sizeBytes": 32768,
      "mode": 33188,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  ]
}
```

* **Instant Undo:** `tuneup.restore_quarantine(sessionId)` reads the manifest, verifies the target destinations are clear, and atomically moves the files back into their exact original paths.

---

## 6. Package Manager Subsystem (`atp-pkg`)

The package manager provides a polymorphic interface across diverse package formats:

```rust
#[async_trait]
pub trait PackageBackend: Send + Sync {
    fn id(&self) -> &'static str;
    fn display_name(&self) -> &'static str;
    fn is_available(&self) -> bool;
    async fn search(&self, query: &str) -> Result<Vec<PackageInfo>>;
    async fn list_installed(&self) -> Result<Vec<PackageInfo>>;
    async fn check_updates(&self) -> Result<Vec<PackageUpdate>>;
    async fn audit_orphans(&self) -> Result<Vec<PackageInfo>>;
    async fn prepare_install(&self, package: &PackageRef) -> Result<PackagePlan>;
    async fn prepare_remove(&self, package: &PackageRef) -> Result<PackagePlan>;
    async fn prepare_orphan_purge(&self) -> Result<PackagePlan>;
}
```

### 6.1 Host Distro Detection & Backend Selection
On startup, `atp-pkg` inspects `/etc/os-release` and probes the system `$PATH`:
- If `flatpak` is installed $\to$ enable `FlatpakBackend`.
- If `pacman` exists $\to$ enable `ArchBackend` (using `libalpm` or `pacman` CLI).
- If `apt-get` exists $\to$ enable `DebianBackend`.
- If `dnf5` or `dnf` exists $\to$ enable `FedoraBackend`.
- Always enable `AppImageBackend` for scanning `~/Applications` and `~/.local/bin`.

### 6.2 Plan & Dependency Impact Diff
No package action executes immediately. Every action first produces a `PackagePlan`:
- **Action Type:** `Install`, `Remove`, `Upgrade`, `PurgeOrphan`.
- **Target Package:** Name, source repository, version change.
- **Dependencies Affected:** Additional libraries installed or removed.
- **Download Size & Disk Delta:** Exact bytes added or freed.
- **Risk Tier:** Categorized as Tier 3 Destructive/Privileged, requiring user approval.

---

## 7. System Monitor & Telemetry Engine (`atp-monitor`)

### 7.1 Sampling Loop & Telemetry Stream
A background Tokio task samples machine health at 1.0 Hz (falling back to 0.2 Hz when the window is minimized):
- **CPU:** Aggregate usage percentage, per-core breakdown, clock frequencies, thermal sensors.
- **Memory:** Active RAM used, cache/buffers, available RAM, swap usage.
- **Disk:** Read/Write throughput (MB/s) via `/proc/diskstats`, mount point capacities.
- **Network:** Receive/Transmit rates (MB/s) via `/proc/net/dev`.
- **Processes:** Top 10 CPU/Memory consumers.

Telemetry is pushed directly to the React frontend over a lightweight Tauri event (`evt://telemetry/tick`), eliminating frontend polling.

### 7.2 System Health Score Algorithm (0–100)
The Health Score is computed deterministically from 5 weighted telemetry vectors:

$$S_{\text{health}} = 100 - (P_{\text{disk}} + P_{\text{mem}} + P_{\text{temp}} + P_{\text{updates}} + P_{\text{junk}})$$

| Vector | Penalty Condition | Max Deduction |
|---|---|---|
| **$P_{\text{disk}}$** | Root or home filesystem $>85\%$ full (scaled linearly to $100\%$) | 30 points |
| **$P_{\text{mem}}$** | Available memory $<10\%$ or active swap thrashing ($>20\%$ swap used) | 25 points |
| **$P_{\text{temp}}$** | Sustained CPU temperature $>80^\circ\text{C}$ ($>90^\circ\text{C}$ = critical) | 15 points |
| **$P_{\text{updates}}$** | $>25$ pending package updates or unpatched kernel advisory | 15 points |
| **$P_{\text{junk}}$** | Cumulative reclaimable junk $>10\text{ GB}$ ($>20\text{ GB}$ = max) | 15 points |

The UI displays the overall score with an expandable breakdown showing users exactly what issues are deducting points and providing one-click remediation actions.

---

## 8. Starship MCP Bridge & Unified Binary Architecture

### 8.1 Dual-Mode Startup Routing (`main.rs`)

```rust
#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();

    if args.iter().any(|arg| arg == "--mcp") {
        // Headless Mode: Run stdio JSON-RPC 2.0 loop without GUI
        atp_mcp::run_stdio_server().await?;
    } else {
        // GUI Mode: Start Unix socket bridge in background, then launch Tauri
        let bridge_handle = atp_mcp::start_unix_socket_bridge().await?;
        tauri::Builder::default()
            // ... setup plugins & IPC ...
            .run(tauri::generate_context!())?;
        bridge_handle.abort();
    }
    Ok(())
}
```

### 8.2 Starship Control Wire Protocol (`atp-mcp`)
When listening on `$XDG_RUNTIME_DIR/starship/bridges/atp.sock`:
1. **Connection & Credential Gate:**
   On `accept()`, ATP calls `libc::getsockopt(fd, SOL_SOCKET, SO_PEERCRED, ...)` to inspect the calling process's UID. If `peer_cred.uid != getuid()`, the connection is immediately terminated without reading bytes.
2. **Handshake Negotiation (`starship/hello`):**
   Responds with application metadata, protocol version (`2024-11-05`), and the full JSON Schema definitions for all registered tools.
3. **Execution Arbitration:**
   Incoming `tools/call` invocations are mapped to internal `Action` structs and executed via `atp-core`.
4. **Emergency Cancellation (`tools/cancel`):**
   Aborts running scans or package tasks immediately via Tokio cancellation tokens.

---

## 9. Privileged Helper Daemon (`atpd-helper`)

To ensure absolute safety, the main application never executes privileged commands directly. All root-level actions are delegated over the system D-Bus to `atpd-helper`:

* **Service Name:** `in.zvirox.AgenticTuneupHelper`
* **Object Path:** `/in/zvirox/AgenticTuneupHelper`
* **Interface:** `in.zvirox.AgenticTuneupHelper1`
* **Polkit Action IDs:**
  - `in.zvirox.agentic-tuneup.pkg-manage`: Package installation, removal, and orphan purging.
  - `in.zvirox.agentic-tuneup.journal-vacuum`: Journal log trimming.
  - `in.zvirox.agentic-tuneup.process-kill`: Sending signals to root-owned processes.
  - `in.zvirox.agentic-tuneup.systemd-control`: Starting, stopping, and restarting systemd system units.

### 9.1 Input Sanitization & Whitelisting
`atpd-helper` implements zero string-concatenated commands. Package names must strictly match `^[a-zA-Z0-9_\-\.\+]+$` and must belong to recognized package repositories. Any attempt to pass path traversal sequences or shell operators (`;&|<>`) results in immediate rejection and audit logging.

---

## 10. File System & XDG Path Specification

ATP adheres strictly to the Linux XDG Base Directory Specification:

| Category | Standard Path | Usage |
|---|---|---|
| **Configuration** | `$XDG_CONFIG_HOME/agentic-tuneup-pro/` (`~/.config/agentic-tuneup-pro/`) | `config.toml`, user custom cleaner rule TOMLs (`rules/*.toml`). |
| **Data & Storage** | `$XDG_DATA_HOME/agentic-tuneup-pro/` (`~/.local/share/agentic-tuneup-pro/`) | `audit.db` (SQLite audit log), `quarantine/` (quarantined files and manifests). |
| **Runtime Socket** | `$XDG_RUNTIME_DIR/starship/bridges/` (`/run/user/<UID>/starship/bridges/`) | `atp.sock` (Unix domain bridge socket for Starship Control). |
| **Plugin Manifest**| `$XDG_DATA_HOME/starship/plugins/` (`~/.local/share/starship/plugins/`) | `atp.json` (capability and topology discovery manifest for Starship Control). |
| **State & Logs** | `$XDG_STATE_HOME/agentic-tuneup-pro/` (`~/.local/state/agentic-tuneup-pro/`) | `atp.log` (daily rotating diagnostics log). |

---

## 11. Security & Safety Invariants

1. **Compulsory Quarantine:** Clean operations never invoke `std::fs::remove_file` or `remove_dir_all` directly on user data; all targets are staged into the quarantine directory with restore metadata.
2. **Protected List Immutability:** The protected file list is hard-coded into the `atp-safety` binary. No TOML rule file, user config, or agent instruction can bypass or disable it.
3. **No Direct Shelling:** All process spawning uses `std::process::Command::new(binary).args(&[...])`. The use of `sh -c` or shell interpreters is strictly prohibited.
4. **Append-Only Audit Trail:** Every single scan, clean, package change, and process termination is written to the SQLite database with user/agent provenance and cryptographic hashes.
5. **Prompt Injection Containment:** Package descriptions, cleaner rule explanations, and system log lines ingested by the agent are wrapped in `<system_data>` blocks. The agent planner explicitly treats them as data, preventing instructions in log files from altering tool execution.

---

*Authored by Zvirox — Cyber Defender · Part of the Mother Ship Suite.*
