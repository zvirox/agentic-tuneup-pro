# Agentic Tuneup Pro — User Guide

Welcome to **Agentic Tuneup Pro (ATP)**, the sovereign, AI-orchestrated Linux system cleaner, package manager, and performance suite designed for privacy-first power users and developers.

---

## 1. System Overview & Architecture

Agentic Tuneup Pro operates as a split-privilege architecture:
- **Desktop Frontend**: Tauri 2 application built with React 19, Tailwind CSS v4, and frosted-glass obsidian styling (`#080B10`).
- **Safety Engine (`atp-safety`)**: Sandboxed quarantine vault with SHA-256 byte-level verification, instant undo, and a hard protected path boundary blocking passwords, SSH keys, and system roots.
- **Privileged Helper Daemon (`atpd-helper`)**: Minimal root D-Bus daemon governed by granular Polkit authentication policies (`in.zvirox.agentic_tuneup.policy`).
- **Starship Bridge (`atp-mcp`)**: Native Model Context Protocol (MCP) server listening on `$XDG_RUNTIME_DIR/starship/bridges/atp.sock` with `SO_PEERCRED` validation.

---

## 2. Navigating the Interface

### 2.1 Universal Command Palette (`Ctrl + K`)
Press <kbd>Ctrl</kbd> + <kbd>K</kbd> (or <kbd>Cmd</kbd> + <kbd>K</kbd>) anywhere in the application, or click the search bar in the top navigation header:
- Type keywords to jump directly between views (`dash`, `cleaner`, `apps`, `processes`, `settings`).
- Trigger instant actions: **Smart Scan & Clean**, **Quarantine Undo**, **Why is my PC slow?**, **Create Pre-Change Snapshot**, and **Reduce Effects**.
- Keyboard navigation: use <kbd>↑</kbd> / <kbd>↓</kbd> arrows and <kbd>Enter</kbd> to execute, or <kbd>Esc</kbd> to dismiss.

### 2.2 Global Keyboard Shortcuts
| Shortcut | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Open Universal Command Palette |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> | Toggle Starship Agent Drawer |
| <kbd>Ctrl</kbd> + <kbd>Space</kbd> | Push-to-Talk Voice Dictation |
| <kbd>Alt</kbd> + <kbd>1</kbd> | Go to System Telemetry Dashboard |
| <kbd>Alt</kbd> + <kbd>2</kbd> | Go to System Cleaner & Quarantine |
| <kbd>Alt</kbd> + <kbd>3</kbd> | Go to Application Manager |
| <kbd>Alt</kbd> + <kbd>4</kbd> | Go to Process Explorer |
| <kbd>Alt</kbd> + <kbd>5</kbd> | Go to Settings & Audit Trail |
| <kbd>Esc</kbd> | Close topmost modal, dialog, or drawer |

---

## 3. Core Modules & Usage

### 3.1 System Telemetry & Health Dashboard
- **Health Score (0–100)**: Evaluates CPU temperature, memory pressure, swap usage, disk availability, and orphan packages.
- **Hardware Sparklines**: Real-time 1 Hz telemetry graphs tracking CPU load, memory utilization, and network throughput without high compositor CPU overhead.
- **"Why is my PC slow?" Advisor**: Click the banner or button to invoke the multi-variable diagnostic correlation engine. It detects thermal throttling, runaway background threads, memory pressure, and noisy desktop indexers (such as `tracker-miner-fs` or `baloo_file`), providing one-click remediations.

### 3.2 System Cleaner & Quarantine Vault
Cleaning in ATP is strictly non-destructive:
1. **Smart Scan**: Analyzes browser caches, stale development artifacts (`target/`, `node_modules`, `.pytest_cache`), package manager caches, and stale system logs.
2. **Safety Checks**: Rules targeting running applications are safely gated to prevent data corruption.
3. **Execution**: Targeted files are moved atomically into an encrypted quarantine session directory (`$XDG_DATA_HOME/agentic-tuneup-pro/quarantine/<session_id>/`) with original permissions and checksums preserved.
4. **Instant Undo**: Click **Undo** at any time to restore all files back to their exact original locations in under 200 ms.

### 3.3 Application Manager
- **Unified Package Inventory**: Displays installed applications across Flatpak, native package managers (`pacman`, `apt`, `dnf`), and AppImage bundles.
- **Orphan Dependency Detection**: Identifies unneeded dependencies left behind by uninstalled software.
- **One-Click Package Actions**: Safely uninstall or update software with clear risk-tier indicators.

### 3.4 Process Explorer & Systemd Units
- **Hierarchical Process Trees**: Groups worker threads under parent applications (e.g. browser renderers or code servers).
- **Graceful Termination**: Uses clean `SIGTERM` signals via `atp-procs` to prevent zombie processes.
- **Systemd Management**: Inspect and manage systemd services with Polkit authorization.

### 3.5 Starship AI Cockpit & Offline Voice Dictation
- **Autonomous Task Planner**: Request natural language system management instructions ("Clean my Docker cache and remove orphan packages"). The agent inspects rules, calculates disk space, and constructs a structured Plan.
- **Tier 3 Confirmation Gates**: Irreversible operations (such as purging system packages) require explicit visual user confirmation.
- **Hands-Free Dictation**: Press <kbd>Ctrl</kbd> + <kbd>Space</kbd> or click the mic button to transcribe commands offline using local Whisper speech-to-text with real-time audio waveform feedback.

### 3.6 Pre-Change Filesystem Snapshots
- Detects installed system snapshot utilities: **Timeshift**, **Snapper**, and **Btrfs root subvolumes**.
- Automatically or manually triggers a restore point prior to applying significant system mutations.

---

## 4. Accessibility & Performance Modes

- **WCAG AA Compliance**: Full keyboard accessibility, 4.5:1 text contrast floor, and screen reader announcements (`aria-live="polite"`).
- **Reduce Effects Mode**: Toggle in **Settings** or via <kbd>Ctrl</kbd> + <kbd>K</kbd> to switch from frosted-glass translucent blur to solid obsidian dark (`#0E131B`), eliminating compositor overhead for low-end GPUs or remote X11/VNC sessions.
