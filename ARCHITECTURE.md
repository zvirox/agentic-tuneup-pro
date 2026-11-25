# ARCHITECTURE.md — Agentic Tuneup Pro (ATP)

**Version:** 2.0 · **Date:** 2026-11-25  
**Status:** Active System Architecture (Aligned with Codebase)  
**Authority chain:** `PRD.md` (Product Requirements) → **this file (System Architecture, Contracts & Boundaries)** → `DESIGN.md` (Locked Linear UI Law) → `API.md` (IPC & MCP Contracts) → `PLAN.md` (Roadmap)  
**Rule:** Documents verified technical structure, process boundaries, crate layout, protocols, and safety invariants implemented in the repository.

---

## 1. Architecture Principles

1. **Single Binary, Dual Operation:**
   A single Rust binary (`agentic-tuneup-pro`) handles both desktop operation and headless MCP automation. Passing `--mcp` runs a headless stdio JSON-RPC 2.0 loop. Normal execution launches the Tauri 2 desktop GUI and spawns the authenticated Starship Unix domain socket bridge (`atp.sock`).
2. **Mother Ship Ecosystem Node:**
   During GUI sessions, ATP publishes `$XDG_DATA_HOME/starship/plugins/atp.json` and listens on `$XDG_RUNTIME_DIR/starship/bridges/atp.sock`. Incoming connections are validated via Linux `SO_PEERCRED` UID checks.
3. **Quarantine-First Non-Destructive Mutations:**
   First-pass cleanups stage targets into `$XDG_DATA_HOME/agentic-tuneup-pro/quarantine/<session_id>/` alongside a `manifest.json` storing original paths, modes, byte sizes, and SHA-256 digests for atomic Undo restore.
4. **Privilege Separation & Zero-Shell Execution:**
   All backend process calls execute directly via `std::process::Command` / `tokio::process::Command` (`sh -c` is prohibited). Root actions target system D-Bus daemon `atpd-helper` governed by Polkit policy `in.zvirox.agentic_tuneup.policy`. *(Note: D-Bus daemon `atpd-helper` is compiled and packaged; client execution wiring from `atp-pkg` to `atpd-helper` is tracked under P0-4 / P1-A.)*
5. **Non-Blocking Async IPC & Solid Linear Matte UI:**
   Heavy filesystem scans, quarantine I/O, and process lookups offload onto `tokio::task::spawn_blocking` inside async Tauri commands so WebKitGTK remains responsive at 60 fps. The UI uses flat, opaque Linear matte surfaces (`check:linear` enforced) with zero blur or dark-mode shadows.
6. **SQLite Audit & Session Ledger:**
   Quarantine sessions, user rule overrides, and audit records persist in SQLite WAL mode (`0600`) at `$XDG_DATA_HOME/agentic-tuneup-pro/audit.db`.

---

## 2. Tech Stack Specification (Verified Against Manifests)

| Layer | Choice | Notes |
| :--- | :--- | :--- |
| **App Shell** | **Tauri 2** | Frameless `1280×800` (`min 1024×640`), `decorations: false`, `transparent: false`. |
| **Frontend UI** | **React 19 + TypeScript + Vite 6** | Strict TypeScript + honest `safeInvoke` IPC layer (`app/src/lib/ipc.ts`). |
| **Styling & Typography** | **Tailwind CSS v4 + `@fontsource/inter`** | Self-hosted Inter font; locked Dark & Light tokens in `app/src/tailwind.css`. |
| **Charts & Visualization** | **Apache ECharts 6 + Inline SVG** | Reactive Dark/Light `echarts-linear-theme.ts` charts + `StatCard` sparklines. |
| **State & Animation** | **Zustand + Motion / CSS** | `150ms ease-out` transitions; respects `prefers-reduced-motion`. |
| **Desktop Icons** | **Lucide React** | Uniform thin-stroke vector iconography (`size-3.5` / `size-4`). |
| **Core Async Runtime** | **Rust 2024 + Tokio** | Parallel scanning (`rayon` / `walkdir`), non-blocking Tauri IPC. |
| **System Telemetry** | **`sysinfo` + `/proc` / `/sys`** | 1.0 Hz background sampler pushing `evt://telemetry/tick`. |
| **D-Bus & Systemd** | **`zbus` (Pure Rust)** | Systemd unit control (`atp-procs`) and root helper daemon (`atpd-helper`). |
| **Storage & Audit** | **SQLite 3 (`rusqlite`)** | WAL mode, `PRAGMA foreign_keys = ON`, `0600` file mode. |
| **MCP Protocol** | **`atp-mcp` + `starship-plugin`** | JSON-RPC 2.0 over stdio (`--mcp`) and `SO_PEERCRED` Unix socket (`atp.sock`). |

---

## 3. System Topology & Process Boundaries

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AGENTIC TUNEUP PRO TOPOLOGY                     │
└────────────────────────────────────────────────────────────────────────┘

 [ USER INTERFACE (Tauri 2 Webview / WebKitGTK · Locked Linear UI) ]
   ┌──────────────────────────────────────────────────────────────────┐
   │  40px TitleBar · Collapsible 240/56px Sidebar · Breadcrumb Bar   │
   │  Dashboard · Cleaner · Apps · Processes · Settings               │
   │  [ Collapsible 384px Right-Side Agent Drawer ]                   │
   └──────────────────────────────────┬───────────────────────────────┘
                                      │ Async Tauri IPC (`spawn_blocking`)
                                      ▼
 [ ATP UNIFIED CORE PROCESS (`agentic-tuneup-pro` · User Privileges) ]
   ┌──────────────────────────────────────────────────────────────────┐
   │  commands.rs · agent.rs · Starship Unix Socket Bridge (`atp-mcp`)│
   └──┬────────────┬────────────┬────────────┬────────────┬───────────┘
      ▼            ▼            ▼            ▼            ▼
  atp-cleaner  atp-safety   atp-monitor   atp-pkg     atp-procs
  Embedded &   Protected    1Hz sysinfo   Flatpak     Process trees
  user TOML    Validator,   RingBuffer,   Native      SIGTERM/KILL
  rules +      Quarantine,  HealthScore,  AppImage    systemd (zbus)
  parallel     SQLite WAL,  Diagnostics   (querying)  autostart
  scanner      Snapshots
                                │
                                │ System D-Bus (Pending client wiring: P1-A)
                                ▼
 [ PRIVILEGED BOUNDARY (`atpd-helper` Root Daemon · Packaged) ]
   ┌──────────────────────────────────────────────────────────────────┐
   │  Service: `in.zvirox.AgenticTuneupHelper`                        │
   │  Polkit:  `packaging/in.zvirox.agentic_tuneup.policy`            │
   │  Strict regex argument validation · Zero shell invocations       │
   └──────────────────────────────────────────────────────────────────┘
```

---

## 4. Actual Workspace & Directory Layout

```
agentic-tuneup-pro/
├── Cargo.toml                       # Workspace root (10 members, Rust 2024)
├── AGENTS.md                        # Locked Linear UI & safety invariants
├── PRD.md                           # Product scope & status matrix
├── ARCHITECTURE.md                  # System topology & crate boundaries (this doc)
├── DESIGN.md                        # Locked Linear UI Law & color tokens
├── API.md                           # IPC commands & MCP wire contracts
├── PLAN.md                          # Roadmap, P0–P3 backlog & accurate checklists
├── CHANGELOG.md
├── README.md
├── docs/                            # USER_GUIDE.md, SAFETY.md, RULE_AUTHORING.md, release-audit.md
├── rules/                           # Built-in TOML rule suites (also embedded via include_str!)
│   ├── app_caches.toml
│   ├── browsers.toml
│   ├── dev_artifacts.toml
│   ├── package_caches.toml
│   └── system.toml
├── packaging/                       # Locked nfpm packaging (.deb, .rpm, .pkg.tar.zst)
│   ├── nfpm.yaml
│   ├── atpd-helper.service
│   ├── agentic-tuneup-pro.desktop
│   ├── in.zvirox.AgenticTuneupHelper.conf
│   ├── in.zvirox.agentic_tuneup.policy
│   └── scripts/{postinstall.sh,preremove.sh}
├── app/                             # Tauri 2 Desktop Application
│   ├── package.json                 # React 19, ECharts 6, Tailwind v4, check:linear
│   ├── scripts/check-linear.mjs     # Automated CSS/hex/blur/shadow gate
│   ├── src-tauri/
│   │   ├── tauri.conf.json          # 1280x800 (min 1024x640), decorations:false
│   │   ├── capabilities/default.json
│   │   └── src/{main.rs,commands.rs,agent.rs}
│   └── src/
│       ├── main.tsx                 # Self-hosted Inter (@fontsource/inter) entry
│       ├── tailwind.css             # Locked Light & Dark tokens + tints
│       ├── App.tsx                  # Shell layout & active route orchestrator
│       ├── lib/ipc.ts               # Honest safeInvoke IPC client
│       ├── types/index.ts
│       └── components/
│           ├── linear/              # Shared Linear UI kit (TitleBar, Sidebar, Breadcrumb, DataTable, etc.)
│           ├── {HealthGauge,TelemetrySparkline,TuneupTelemetryChart,TopConsumersCard}.tsx
│           ├── {CategoryTree,QuarantineView,SamplePathsModal,UndoButton}.tsx
│           ├── {AppsView,ProcessExplorer,DiagnosticModal,CommandPalette}.tsx
│           └── {AgentDrawer,PlanStepCard,VoiceWaveform,AuditTimeline,AriaAnnouncer}.tsx
└── crates/
    ├── atp-core/                    # RiskTier, Action, Plan, CoreError, ExecutionResult
    ├── atp-safety/                  # ProtectedValidator, QuarantineStore, AuditStore, SnapshotManager
    ├── atp-cleaner/                 # RuleEngine (embedded + disk), ParallelScanner, CleanerExecutor
    ├── atp-pkg/                     # PackageManagerManager, Flatpak, Arch/Debian/Fedora, AppImage
    ├── atp-monitor/                 # TelemetryMonitor, RingBuffer, HealthScore, DiagnosticEngine
    ├── atp-procs/                   # ProcessManager (bounds/critical checks), Systemd (zbus), Autostart
    ├── atp-mcp/                     # McpDispatcher (bounded kill_process), UnixSocketServer, stdio
    ├── atp-voice/                   # AudioCaptureSession & WhisperEngine (currently preview simulation)
    └── atpd-helper/                 # System D-Bus daemon + validator
```

---

## 5. Subsystems Implementation Status & Known Gaps

### 5.1 Safety & Quarantine (`atp-safety`, `atp-cleaner`) — Operational
- **Protected Boundary:** Component-aware OS root matching (`/dev` no longer blocks `/developer`) + symlink/traversal canonicalization (`ProtectedValidator::validate`).
- **IPC Serialization Optimization:** `cleaner_scan` strips massive `matched_paths` vectors before crossing IPC, returning concise `sample_paths` previews.
- **Pending P1-B:** Browser cookies/history rules, multi-browser profile discovery (Edge, Opera, Vivaldi, Flatpak/Snap profiles), cookie keep-list, and automatic 7-day startup purge.

### 5.2 MCP Bridge (`atp-mcp`) — Operational (Bounded)
- `tuneup.kill_process` rejects `pid <= 1 || pid > i32::MAX as u32`, delegates to `ProcessManager::send_signal`, and writes an SQLite audit row.
- `tuneup.remove_packages` and `tuneup.purge_orphans` currently return `"prepared"` until the P1-A D-Bus package execution bridge is connected.

### 5.3 Package Operations (`atp-pkg`, `atpd-helper`) — Querying Done / Execution Pending
- Discovery and orphan enumeration work natively (`flatpak`, `pacman`, `apt`, `dnf`, `AppImage`).
- `AppsView` clearly marks action plans as preview-only until P0-4 / P1-A connects the `zbus` client to `in.zvirox.AgenticTuneupHelper`.

### 5.4 Agent Cockpit & Voice (`agent.rs`, `atp-voice`) — UI Ready / Backend Hardening Pending
- **Pending P0-5:** Replace frontend-generated `usr_sig_*` token prefix check with backend-generated, single-use, 5-minute expiry cryptographic nonces.
- **Pending P0-7 / P1-D:** Replace hardcoded plan disk deltas and keyword fallback with live scan sums, structured LLM tool calling, and keyring API-key storage.
- **Pending P0-6 / P1-D:** `atp-voice` currently uses a simulated preview buffer (`Voice (Preview)` in UI) until `cpal` microphone capture and `whisper-rs` inference are integrated.

---

*Authored by Zvirox — Cyber Defender · Part of the Mother Ship Suite.*
