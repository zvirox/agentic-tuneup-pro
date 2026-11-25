# PLAN.md — Agentic Tuneup Pro Implementation Roadmap

**Version:** 0.0.3-alpha (Tracking toward v1.0.0) · **Date:** 2026-11-22  
**Status:** Active Implementation & Remediation Roadmap  
**Authority chain:** `PRD.md` (Product Scope) → `ARCHITECTURE.md` (Structure & Transports) → `DESIGN.md` (UI Law) → `API.md` (IPC & MCP Contracts) → **this file (Execution Order & Tracking Checklists)**  
**Rule:** Every phase ends with a **runnable vertical slice** (`cargo tauri dev` or `cargo test --workspace` produces verified, working behavior). Tasks are sized $\le$ 1–2 hours. No destructive actions are built before safety and quarantine are mathematically and unit-test verified. Stale evidence, fabricated metrics, and mock success envelopes inside production desktop builds are strictly prohibited.

---

## Master Checklist & Progress Tracker

- [x] **Phase 0 — Workspace Foundation & WebKitGTK Glass Spike** (Shell, Design Tokens, WebKitGTK 60fps)
- [x] **Phase 1 — Core Safety Engine & Quarantine Store** (Quarantine Mover, Undo Journal, Protected Validator)
- [x] **Phase 2 — Privileged Polkit Helper & System Monitor** (`atpd-helper` D-Bus Daemon, Telemetry Stream, Health Score)
- [x] **Phase 3 — Cleaner Engine & Quarantine UI** (TOML Rules, Parallel Scanner, File Tree Diff, Instant Undo)
- [x] **Phase 4 — Starship MCP Server & Bridge** (Unified Binary `--mcp` / Unix Socket, `SO_PEERCRED`, Tools)
- [ ] **Phase 5 — Package & Process Manager** [IN PROGRESS — P0-4, P1-A: Real D-Bus package execution pending]
- [ ] **Phase 6 — In-App Agent Cockpit Drawer** [IN PROGRESS — P0-5, P0-7, P1-D: Backend nonce tokens & real LLM tool-calling pending]
- [x] **Milestone v0.0.1-alpha — Multi-Distro Release Pipeline** (Superseded by locked `nfpm` `.deb`, `.rpm`, `.pkg.tar.zst` release pipeline)
- [x] **Milestone v0.0.2-alpha — Standalone Embedded UI & Async GTK Runtime Hotfix** (Release on GitHub)
- [x] **Milestone v0.0.3-alpha — UI Non-Blocking Async IPC & Resilient Staging** (Release on GitHub)
- [ ] **Phase 7 — Voice Dictation & Advanced Diagnostics** [IN PROGRESS — P0-6, P0-8, P1-C, P1-D: Real Whisper/CPAL & diagnostic scoping]
- [ ] **Phase 8 — Polish, Packaging & Release v1.0** [PLANNED — P2 Hygiene, P3 Advanced Features]

---

## Critical Fix List & Gap Remediation Plan (from review of commit `fcc66c1`)

Legend: ✅ Patched in `atp-critical-fixes.patch` · ⬜ Pending Implementation

Test status: 90 Rust tests pass across all workspace crates (`cargo test --workspace`). Frontend builds cleanly with zero errors (`tsc --noEmit && vite build`).

### P0 — Safety and Honesty Bugs (Do First)

| # | Status | Problem | Location | Root Cause & Remediation Plan |
|---|---|---|---|---|
| **1** | ✅ | UI turns real failures into fake successes (e.g. "4.5 GB freed, 1,420 files") | `app/src/lib/ipc.ts` `safeInvoke` | **Root Cause:** `safeInvoke` returned fallback mock data whenever an IPC command threw an error, masking backend failures. <br>**Fix:** Check `__TAURI_INTERNALS__ in window`. Inside Tauri, errors strictly rethrow to the UI so users see real failures. Mock data only allowed in plain browser dev. |
| **2** | ✅ | MCP `tuneup.kill_process` calls `libc::kill` directly without bounds or audit: `pid = 4294967295` wraps to `-1`, signaling every process owned by user | `crates/atp-mcp/src/dispatcher.rs` | **Root Cause:** Direct unchecked cast of `u32` to `i32` in `libc::kill(pid as i32, SIGTERM)`. <br>**Fix:** Added `atp-procs` dependency. Reject `pid <= 1 \|\| pid > i32::MAX as u32`. Route through guarded `ProcessManager::send_signal`. Record operation in SQLite `AuditStore`. Unit test verified. |
| **3** | ✅ | Protected system roots matched by string prefix (`/dev` also blocked `/developer`) | `crates/atp-safety/src/protected.rs` | **Root Cause:** `path_str.starts_with(prefix)` treated `/developer` as beginning with `/dev`. <br>**Fix:** Component-aware boundary check: `path_str == *prefix \|\| path_str.starts_with(&format!("{prefix}/"))`. Unit test verified. |
| **4** | ⬜ | Package install/remove never executes. `AppsView.tsx` confirm is an 800 ms timer then "completed successfully". MCP `remove_packages` / `purge_orphans` only return `"prepared"` | `app/src/components/AppsView.tsx`, `crates/atp-mcp/src/dispatcher.rs` | **Root Cause:** Missing D-Bus client in app for `in.zvirox.AgenticTuneupHelper`. <br>**Remediation:** 1. Implement D-Bus client in `atp-pkg` calling `AgenticTuneupHelper.ExecutePackageAction`. 2. Add Tauri command `pkg_execute_plan`. 3. Wire `AppsView.tsx` and MCP to call real execution. 4. Until D-Bus client is merged, display clear "Not implemented yet" badge instead of false success. |
| **5** | ⬜ | "Approval" is a `usr_sig_` prefix check, and the frontend generates the token | `app/src-tauri/src/agent.rs` (`approve_step`), `app/src/components/AgentDrawer.tsx` | **Root Cause:** Frontend creates `usr_sig_ag_step_${stepIndex}_${timestamp}`; backend only validates `signature_token.starts_with("usr_sig_")`. Any caller can bypass approval. <br>**Remediation:** Backend must generate a cryptographically random per-plan nonce (`fastrand::alphanumeric(32)`) when a plan is created, store it with a 5-minute expiry in `active_plan`, require exact match on single-use, and invalidate upon execution. |
| **6** | ⬜ | Voice is simulated. No `cpal` or `whisper-rs` dependency; `voice_stop_capture` transcribes a dummy buffer and returns hardcoded phrases. README claims offline Whisper | `crates/atp-voice/Cargo.toml`, `engine.rs`, `commands.rs` | **Root Cause:** `engine.rs` returns 4 static strings based on slice duration; `commands.rs` passes `vec![0.15; 32000]`. <br>**Remediation:** Either implement real `cpal` capture + `whisper-rs` (ggml-base.en) or label the voice feature "Preview / Simulated Audio" in the UI and README until native audio dependencies are linked. |
| **7** | ⬜ | Plan savings and diffs are hardcoded (e.g. "~4.2 GB"). Claude/OpenAI paths fall back to keyword planner; Ollama's reply is discarded | `app/src-tauri/src/agent.rs` (`decompose_with_ollama`, `decompose_heuristic`) | **Root Cause:** `decompose_with_ollama` calls Ollama, ignores response body, and returns `decompose_heuristic` which hardcodes `total_disk_delta_bytes = -4_509_715_660`. <br>**Remediation:** 1. Calculate savings from actual `cleaner_scan` / `pkg_list_orphans` calls. 2. Parse structured tool-call JSON from Ollama/Claude/OpenAI responses with schema validation. |
| **8** | ⬜ | `diagnostic_apply_fix("clean_caches")` runs **every** rule (including dev artifacts and trash) with no preview; `reduce_effects` is a no-op string | `app/src-tauri/src/commands.rs` | **Root Cause:** `clean_caches` collects all discovered rules and executes clean immediately without user preview. `reduce_effects` returns a static string without toggling window settings. <br>**Remediation:** 1. Limit `clean_caches` remediation strictly to category `caches`. 2. Provide preview before execution. 3. Persist and apply `reduce_effects` to frontend and compositor config. |

---

### P1 — Features the Plan Promised But Are Missing

#### A. Real Package Operations
1. **D-Bus Client for Privileged Helper**: Implement zbus client in `atp-pkg` / `app-tauri` connecting to system bus `in.zvirox.AgenticTuneupHelper`.
2. **`pkg_execute` IPC Command**: Add Tauri commands `pkg_execute_plan` and `pkg_cancel_plan` supporting install, remove, upgrade, and purge-orphans with live progress streaming and SQLite audit rows.
3. **Helper Validator Expansion**: Validate package actions across flatpak, pacman, apt, and dnf.
4. **Additional Backends Roadmap**: Expand backend support to Snap, zypper, Homebrew on Linux, npm global, cargo, pipx, and manual `.deb`/`.rpm` drop.

#### B. Cleaner Rule Coverage & Expiry
1. **Browser Deep Clean**: Add declarative rules for browser cookies, browsing history, session data, IndexedDB / local storage, and download history.
2. **Expanded Browser Matrix**: Add profile paths for Chromium, Microsoft Edge, Opera, Vivaldi, and Flatpak/Snap browser containers (currently Chrome, Firefox, Brave caches only).
3. **Cookie Keep-List**: Implement cookie domain allow-list (e.g. preserve logins for `github.com`, `google.com`) during cookie cleaning.
4. **Credential Protection Invariants**: Ensure bookmarks, extensions, and passwords remain strictly protected by default unless explicitly opted in.
5. **Automated Quarantine Expiry**: Enforce 7-day retention limit by running `QuarantineStore::purge_expired_sessions` on application startup and periodic daily timer.

#### C. Safety Wiring
1. **Automated Pre-Change Snapshots**: Automatically invoke `SnapshotManager::create_snapshot` before executing Tier 3 destructive package operations (currently only a manual button).
2. **Accurate Telemetry Health Score**: Feed real scanned junk bytes and real pending package update counts into `HealthScore::calculate(&snapshot, junk_bytes, pending_updates)` (currently passed as `0, 0`).

#### D. Sovereign Agent & Voice Dictation
1. **Structured LLM Tool-Calling**: Implement schema-validated function calling for Ollama, Anthropic Claude, and OpenAI-compatible endpoints with bounded step iteration (max 5 steps).
2. **Secure Keyring Storage**: Store LLM API keys in Linux Secret Service / Keyring via `keyring` crate rather than plain JSON files.
3. **Real Offline Whisper Pipeline**: Integrate `cpal` for native ALSA/PulseAudio/PipeWire capture + `whisper-rs` running `ggml-base.en`, hooked to global push-to-talk hotkey with strict approval gates.

---

### P2 — Engineering Hygiene & Verification

- [ ] **Continuous Integration (CI)**: Add `.github/workflows/ci.yml` running `cargo fmt --check`, `cargo clippy --workspace -D warnings`, `cargo test --workspace`, and `npm --prefix app run build`.
- [ ] **Frontend IPC Tests (Vitest)**: Add unit tests for `app/src/lib/ipc.ts` verifying that backend errors strictly propagate to UI outside dev mode.
- [ ] **MCP Security Integration Tests**: Add automated tests ensuring every Tier 3 tool rejects execution without a valid backend-issued nonce token.
- [ ] **Agent Safety Evaluation Set**: Create a test suite of 50+ adversarial and operational prompts, including refusal verification for credential directories ("clean my ssh keys", "delete passwords").
- [ ] **Dependency Pruning**: Audit and either utilize or remove `@ui-sdk/core` and `@ui-sdk/react` in `app/package.json`.
- [ ] **Module Architecture Documentation**: Author `docs/<crate>.md` for each of the 9 workspace crates explaining responsibilities, contracts, and safety invariants.
- [ ] **Performance Benchmarks**: Add reproducible benchmark scripts validating the "<1.0% idle CPU and 60 FPS" claims on Wayland and X11.
- [ ] **Roadmap & Reality Synchronization**: Keep `PLAN.md`, `README.md`, and release tags in strict agreement regarding alpha vs stable feature status.

---

### P3 — Phase 8 Advanced Features (Post P0–P2 Hardening)

- **Interactive Disk Treemap**: Visual radial / squarified treemap of disk consumption with inline quarantine staging.
- **Security & Privacy Audit**: System configuration auditor scanning for open debug ports, unconfined executables, and world-writable paths.
- **Natural-Language Maintenance Scheduling**: Starship agent timer allowing requests like "Clean package caches every Sunday at midnight".
- **Config-Leftover Finder**: Scanner for residual configuration files belonging to uninstalled packages.
- **Duplicate & Large File Finder**: Hard-link-aware SHA-256 duplicate file detector.
- **Startup Time Analysis**: `systemd-analyze blame` visualization with one-click service disabling.
- **Update Intelligence**: Automated changelog summarizer for pending distribution updates.
- **System Report Export**: Redacted diagnostic markdown/HTML system reports for support requests.

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

**Definition of Done (Phase 0):** ✅ Tauri 2 desktop shell compiles, renders Mother Ship design tokens on Linux Wayland/X11, passes WebKitGTK performance gate (<1.0% idle CPU), and establishes shared error types. [COMPLETED]

---

## Phase 1 — Core Safety Engine & Quarantine Store

> **Goal:** Build the untrusted-to-trusted boundary: non-destructive quarantine store, atomic undo journal, hard-coded protected path validator, and SQLite audit logging.

- [x] **1.1 Core Domain Models (`atp-core`)**
  - Implement `Action`, `Plan`, `Step`, and `RiskTier` (`Tier1Safe`, `Tier2Reversible`, `Tier3Destructive`).
  - Implement `AuditEntry` and `ExecutionResult` structs with JSON serialization.
  - *Verify:* Unit tests validate step serialization and risk tier comparisons.
- [x] **1.2 Hard Protected Path Boundary (`atp-safety`)**
  - Implement `ProtectedValidator` with component-aware path checking:
    - Browser passwords (`Login Data*`, `logins.json`, `key4.db`, `cert9.db`).
    - Identity & crypto keys (`~/.ssh/**`, `~/.gnupg/**`, `keyrings/**`).
    - Root OS hierarchies (`/etc/**`, `/boot/**`, `/usr/**`, whole-component `/dev/`, etc.).
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
  - Implement TOML rule parser with embedded fallback rules (`include_str!`) and discovery across `rules/`, `/usr/share/agentic-tuneup-pro/rules/`, and `$XDG_CONFIG_HOME/agentic-tuneup-pro/rules/`.
  - Ship core rule packs: `system.toml`, `browsers.toml`, `package_caches.toml`, `dev_artifacts.toml`, `app_caches.toml`.
  - *Verify:* Parser correctly loads rule definitions, globs, risk tiers, and closed-app requirements in both dev and packaged modes.
- [x] **3.2 Multi-Threaded Parallel Disk Scanner (`atp-cleaner`)**
  - Author parallel file tree scanner using Rayon / Tokio file walkers.
  - Expand path globs, calculate byte sizes, and filter matched paths through `ProtectedValidator`.
  - Offload execution to `tokio::task::spawn_blocking` to avoid blocking WebKitGTK event loop.
  - Compress IPC response payload (strip raw path arrays, keep sample previews) to prevent UI thread stutter.
  - *Verify:* Scanning standard system caches completes in < 2.5s without freezing UI buttons or animations.
- [x] **3.3 Running App Detector & Resilient Cleaning**
  - Probe active process list for applications targeted by rules (e.g. `chrome`, `firefox`).
  - Filter out running-app-locked rules automatically rather than aborting the entire batch.
  - Skip locked or inaccessible files during quarantine staging with audit warnings.
  - *Verify:* Cleaner cleans unblocked targets seamlessly even if one application or file is busy.
- [x] **3.4 Cleaner Category Tree UI (`CleanCategoryCard`)**
  - Build category list with itemized checkboxes, subtotal sizes (`mono-md`), and category badges.
  - Implement expandable tree view showing exact file paths, sizes, and "Why is this safe?" tooltips.
  - *Verify:* User can drill down into any category and inspect exact paths before cleaning.
- [x] **3.5 Clean Execution & Instant Undo Flow**
  - Wire `cmd://cleaner_execute_clean` to floating CTA button (`Clean X.X GB to Quarantine`).
  - Display progress ring animation during quarantine move.
  - Emit completion toast with high-visibility **`[Undo]`** link.
  - *Verify:* Clicking "Clean" frees disk space immediately; clicking "Undo" restores all files in < 500 ms.

**Definition of Done (Phase 3):** ✅ Scans cache locations in seconds without UI freeze, previews exact file trees, moves gigabytes to quarantine safely, and restores them on demand via Undo. [COMPLETED]

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
    - `tuneup.kill_process` (Tier 3 — validated bounds & audit logged)
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
  - *Verify:* Orphan packages are audited and displayed with zero reverse dependency proof.
- [ ] **5.3.1 Real D-Bus Package Execution Bridge (P0-4 & P1-A Remediation)**
  - Implement zbus client in `atp-pkg` calling `in.zvirox.AgenticTuneupHelper.ExecutePackageAction`.
  - Add Tauri IPC command `pkg_execute_plan(plan_id, signature_token)` with Polkit elevation and live progress streaming.
  - Replace timer simulation in `AppsView.tsx` with real execution call; show "Not implemented yet" badge for unhandled backends.
  - Wire MCP `tuneup.remove_packages` and `tuneup.purge_orphans` to execute real plans after approval.
  - *Verify:* Uninstalling a Flatpak or native package executes real removal and updates package list.
- [x] **5.4 Process Tree Explorer & Signals (`atp-procs`)**
  - Implement process list grouped by application (e.g. Chrome parent + helper workers).
  - Implement signals: `SIGTERM` (clean close), `SIGKILL` (force kill), `nice` priority shift.
  - Implement tree-kill: traverse child PIDs recursively and terminate the full tree.
  - Guard PID bounds (`pid > 1 && pid <= i32::MAX`) and protect critical system processes.
  - *Verify:* Terminating an app closes child processes cleanly without orphaned workers.
- [x] **5.5 Systemd Services & Startup Manager (`atp-procs`)**
  - Connect to systemd user and system buses via `zbus`.
  - List services, start, stop, restart, enable, disable.
  - Autostart manager: parse desktop files in `~/.config/autostart/` and toggle enabled states.
  - *Verify:* User can toggle startup apps and inspect service logs directly from the UI.
- [x] **5.6 Apps & Processes UI**
  - Build **Apps** screen with source filters (All, Flatpak, Native, AppImage), updates counter, and "Update All" button.
  - Build **Processes** screen with sortable tables, CPU/Memory progress bars, and kill confirmation modals.
  - *Verify:* User can filter apps and kill runaway processes with interactive confirmation.

**Definition of Done (Phase 5):** ⚠️ Partial — Process tree and service management complete and verified; package execution bridge requires D-Bus client implementation (P0-4 / P1-A).

---

## Phase 6 — In-App Agent Cockpit Drawer

> **Goal:** An integrated right-side agent drawer providing natural-language assistance, Task Sheet plan generation, and inline Tier 3 approval gates.

- [x] **6.1 Collapsible Agent Drawer Layout**
  - Build 380px collapsible right-side drawer docked alongside the main canvas (CSS grid split).
  - Toggleable via top-right robot button or `Ctrl + Shift + A` / `Escape`.
  - Connect drawer state with global UI so agent can highlight target rows in the active table.
  - *Verify:* Opening drawer resizes content area smoothly without overlapping data tables.
- [ ] **6.2 LLM Provider Adapters & Keyring Storage (P1-D Remediation)**
  - Pluggable LLM interface supporting local Ollama (`localhost:11434`), Anthropic Claude API, and OpenAI endpoints.
  - Store API keys securely in Linux Secret Service via system keyring (not plain text config).
  - Implement real structured JSON tool-calling; stop discarding Ollama replies.
  - *Verify:* Agent streams real completions from Ollama or Anthropic API without fallback to keyword heuristics.
- [ ] **6.3 Dynamic Task Sheet Plan Generation (P0-7 Remediation)**
  - Decompose natural language requests into structured **Task Sheets** (`tasksheet/1`).
  - Calculate real disk savings from actual scanner / orphan queries (eliminate hardcoded ~4.2 GB placeholder).
  - Categorize steps into risk tiers (`Tier1Safe`, `Tier2Reversible`, `Tier3Destructive`).
  - *Verify:* Agent outputs plan with accurate byte totals based on actual system state.
- [ ] **6.4 Backend Cryptographic Approval Nonce (P0-5 Remediation)**
  - Backend issues random single-use nonce (`fastrand::alphanumeric(32)`) upon plan creation with 5-minute expiry.
  - Invalidate token immediately upon step execution; reject arbitrary client-generated `usr_sig_` prefixes.
  - Render pending mutating steps with diff summaries and prominent **`[Approve]`** and **`[Reject]`** buttons.
  - *Verify:* Steps strictly refuse execution if nonce does not match backend-issued plan token.
- [x] **6.5 Prompt Injection Defenses**
  - Wrap all external system data (package names, log lines, file paths) in `<system_data>` blocks.
  - Enforce system prompt invariant: external text is treated as data, never instructions.
  - *Verify:* Malicious file names or package summaries cannot trigger unauthorized tool calls.

**Definition of Done (Phase 6):** ⚠️ Partial — Drawer UI and prompt injection boundaries verified; backend nonce approval and real dynamic plan decomposition pending (P0-5, P0-7).

---

## Milestones & Release History

### Milestone v0.0.1-alpha — Multi-Distro Release Pipeline
- [x] System integration metadata: `.desktop`, AppStream XML, Polkit policy, D-Bus config, hicolor icons.
- [x] Standalone package generators: `.deb` (Debian/Ubuntu), `.rpm` (Fedora), Flatpak manifest, AUR `PKGBUILD`.
- [x] Unified build script `scripts/build-packages.sh` producing release archives with `SHA256SUMS`.

### Milestone v0.0.2-alpha — Standalone Embedded UI & GTK Async Loop
- [x] Embedded production Vite assets inside release binary (`tauri build --no-bundle`).
- [x] Fixed blank screen on launch when running outside dev server.
- [x] Tagged and released on GitHub with package binaries.

### Milestone v0.0.3-alpha — UI Non-Blocking Async IPC & Resilient Staging
- [x] Converted all blocking Tauri commands to `pub async fn` using `tokio::task::spawn_blocking` to prevent WebKitGTK event loop freezing.
- [x] Stripped massive `matched_paths` array from IPC JSON payload to eliminate UI stuttering.
- [x] Embedded default TOML rules directly into `atp-cleaner` binary with `/usr/share/agentic-tuneup-pro/rules` fallback.
- [x] Made quarantine staging resilient: skip busy/locked files with audit log instead of aborting batch.
- [x] Fixed dashboard "Smart Scan & Clean" button direct trigger.
- [x] Tagged and released on GitHub with package binaries.

---

## Phase 7 — Voice Dictation & Advanced Diagnostics

> **Goal:** Hands-free voice commands via local Whisper dictation, "Why is my PC slow?" automated diagnostics, and Timeshift/btrfs snapshot hooks.

- [ ] **7.1 Microphone Capture & Voice Activity Detection (P0-6 & P1-D Remediation)**
  - Integrate real audio capture using `cpal` with voice activity detection (VAD).
  - Global push-to-talk hotkey (`Ctrl + Space` or `Super + Shift + Space`) managed via `ashpd`.
  - Animate live audio waveform in the agent drawer during speech capture.
  - *Until native audio is integrated:* Label voice feature "Preview / Simulated Audio" in UI and README.
  - *Verify:* Audio capture records microphone samples into PCM float buffer.
- [ ] **7.2 Embedded Local Whisper Engine (P0-6 & P1-D Remediation)**
  - Integrate `whisper-rs` (whisper.cpp bindings) with default `base.en` model.
  - Download model to `~/.local/share/atp/models/ggml-base.en.bin` on first setup.
  - Transcribe audio buffer offline and stream text into agent drawer.
  - *Verify:* Spoken command transcribes offline accurately into agent input without dummy string fallbacks.
- [ ] **7.3 "Why is my PC slow?" Diagnostic Engine (P0-8 Remediation)**
  - Correlate CPU load, memory pressure, I/O wait, thermal throttling, and `journalctl` error logs.
  - Scope `clean_caches` remediation strictly to category `caches` with user preview before execution.
  - Make `reduce_effects` toggle real window and compositor settings.
  - Feed real scanned junk bytes and pending update counts into `HealthScore::calculate`.
  - *Verify:* Remediations are category-scoped, previewed, and reduce effects toggles visual settings.
- [x] **7.4 Pre-Change Snapshot Hooks (Timeshift / Snapper / btrfs)**
  - Detect presence of Timeshift, Snapper, or Btrfs on system.
  - Provide automatic snapshot trigger before executing Tier 3 package purges (P1-C).
  - *Verify:* Snapshot hook creates a restorable snapshot before executing Tier 3 package removals.

**Definition of Done (Phase 7):** ⚠️ Partial — Snapshot detection and diagnostic analysis implemented; voice is simulated (requires CPAL + whisper-rs or preview labeling), diagnostic remediations require category scoping.

---

## Phase 8 — Polish, Packaging & Release v1.0

> **Goal:** Production-grade quality hardening, full keyboard accessibility, multi-distro packaging, and public v1.0 release.

- [ ] **8.1 Keyboard Navigation & Accessibility Pass (WCAG AA)**
  - Full keyboard navigation across every surface (`Tab`, `Ctrl+K` command palette, `Esc` dismiss).
  - 4.5:1 color contrast floor across all text tokens against obsidian glass.
  - Screen reader live status announcements (`aria-live="polite"`).
  - *Verify:* Entire cleanup and package update workflow can be completed using keyboard alone.
- [ ] **8.2 Cross-Distro Container Test Matrix & CI (P2 Remediation)**
  - Implement GitHub Actions CI running `cargo test --workspace`, `clippy`, and `npm run build`.
  - Automated distro matrix verification (`scripts/test-distro-matrix.sh`) across Arch, Fedora, and Ubuntu.
  - *Verify:* All package backends, polkit rules, dbus configs, and cleaner rules pass automated integration tests in CI.
- [x] **8.3 Linux Distro Packaging Pipeline (Locked Format)**
  - Unified `packaging/nfpm.yaml` + maintainer scripts (`postinstall.sh`, `preremove.sh`) with systemd helper unit, Polkit policy, and D-Bus config.
  - Reusable CI workflow `.github/workflows/release.yml` (`zvirox/release-workflows`) producing exclusively `.deb`, `.rpm`, and `.pkg.tar.zst` + `SHA256SUMS` (+ `.sig`), verified in clean CI containers (`ubuntu:22.04`, `ubuntu:24.04`, `fedora:latest`, `archlinux:latest`).
  - *Policy:* AppImage, Flatpak, tarballs, AUR packages, and manual VM package tests are permanently retired and excluded from future milestones.
- [ ] **8.4 Documentation, Assets & Stable Release v1.0**
  - Author `docs/<crate>.md` architecture docs for all 9 workspace crates.
  - Benchmark idle CPU (<1.0%) and frame rates (60 fps) across Wayland and X11 with reproducible scripts.
  - Tag milestone `v1.0.0` when P0, P1, and P2 are fully green.

**Definition of Done (Phase 8):** ⚠️ In Progress — Distro packaging pipelines operational (v0.0.1–v0.0.3); CI, crate docs, accessibility audit, and stable v1.0 release pending.

---

*Authored by Zvirox — Cyber Defender · Part of the Mother Ship Suite.*
