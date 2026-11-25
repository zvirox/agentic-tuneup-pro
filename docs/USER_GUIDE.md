# Agentic Tuneup Pro — User Guide

Welcome to **Agentic Tuneup Pro (ATP)**, the safety-first Linux system cleaner, unified package inspector, and live hardware telemetry suite built with a high-contrast Linear matte desktop interface.

---

## 1. System Architecture Overview

Agentic Tuneup Pro uses a split-privilege Linux design:
- **Desktop Frontend:** Tauri 2 application built with React 19, Tailwind CSS v4, self-hosted `Inter`, Apache ECharts 6, and flat matte Light & Dark themes (toggled from the `40px` title bar).
- **Safety Engine (`atp-safety`):** Sandboxed quarantine vault with SHA-256 verification, instant Undo, and a hard protected path boundary blocking passwords, SSH/GPG keys, and whole-component OS roots.
- **Privileged Helper Daemon (`atpd-helper`):** Minimal root D-Bus daemon governed by Polkit policies (`in.zvirox.agentic_tuneup.policy`).
- **Starship Bridge (`atp-mcp`):** Local MCP server listening on `$XDG_RUNTIME_DIR/starship/bridges/atp.sock` with `SO_PEERCRED` UID validation, plus headless `--mcp` stdio mode.

---

## 2. Navigating the Interface

### 2.1 Universal Command Palette (`Ctrl + K`)
Press <kbd>Ctrl</kbd> + <kbd>K</kbd> (or click **Search commands** in the breadcrumb bar) anywhere in the app:
- Jump directly between views (**Dashboard**, **System Cleaner**, **Applications**, **Processes**, **Settings & Audit**).
- Trigger actions: **Smart Scan & Clean**, **Quarantine Vault & Undo**, **Why is my PC slow?**, **Create Pre-Change Snapshot**, and **Toggle Dark / Light Theme**.
- Navigate with <kbd>↑</kbd> / <kbd>↓</kbd>, execute with <kbd>Enter</kbd>, or dismiss with <kbd>Esc</kbd>.

### 2.2 Global Keyboard Shortcuts
| Shortcut | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Open Universal Command Palette |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> | Toggle Starship Agent Drawer |
| <kbd>Ctrl</kbd> + <kbd>Space</kbd> | Voice Dictation Preview (when Agent Drawer is open) |
| <kbd>Alt</kbd> + <kbd>1</kbd> | Go to Dashboard |
| <kbd>Alt</kbd> + <kbd>2</kbd> | Go to System Cleaner & Quarantine |
| <kbd>Alt</kbd> + <kbd>3</kbd> | Go to Applications |
| <kbd>Alt</kbd> + <kbd>4</kbd> | Go to Processes & Services |
| <kbd>Alt</kbd> + <kbd>5</kbd> | Go to Settings & Audit Trail |
| <kbd>Esc</kbd> | Close topmost dialog or drawer |

---

## 3. Core Views & Workflows

### 3.1 System Telemetry & Health Dashboard
- **Stat Cards & Sparklines:** Displays Health Score, Disk Used, Memory Used, Cleanable Space, CPU Load, and Network Throughput in real time (`1.0 Hz` telemetry stream).
- **Live ECharts Telemetry:** Interactive CPU, Memory, and Disk chart with timeframe range tabs (`1W`, `1M`, `3W`, `YTD`, `Total`).
- **Disk Analyzer & Top Resource Consumers:** Shows cleanable cache category distribution and the highest-usage process trees.
- **"Why is my PC slow?" Advisor:** Correlates temperature sensors, CPU/RAM pressure, and background indexers (`tracker-miner-fs`, `baloo_file`) into plain-English findings and remediation options.

### 3.2 System Cleaner & Quarantine Vault
1. **Smart Scan:** Parallel scanner checks embedded and custom TOML rules (`~/.config/agentic-tuneup-pro/rules/`) for browser caches, stale build folders (`target/`, `node_modules`), package caches, and temp files.
2. **Running App Safety:** Automatically skips rules locked by open applications (`requires_closed`) so active app sessions stay safe.
3. **Resilient Quarantine & Undo:** Staged files move to `$XDG_DATA_HOME/agentic-tuneup-pro/quarantine/<session_id>/` with SHA-256 manifests. Click **Undo** to restore files back to exact original paths and modes.

### 3.3 Applications & Packages
- Inspect installed **Flatpak**, **pacman** / **apt** / **dnf**, and **AppImage** packages, check pending updates, and audit orphaned dependencies.
- *(Note: Privileged uninstall/purge plan execution via the `atpd-helper` D-Bus bridge is currently preview-only and tracked for completion in Phase 5.)*

### 3.4 Processes & Systemd Units
- View processes grouped by parent application or individually with CPU and Memory progress bars.
- Safely terminate process trees (`SIGTERM` / `SIGKILL`) with critical-process protection.
- Start, stop, or restart systemd units and toggle `~/.config/autostart/` entries.

### 3.5 Agent Drawer & Pre-Change Snapshots
- **Starship Agent Drawer:** Toggle via top-right **Agent** button (`Ctrl+Shift+A`). Inspect structured Task Sheets before running actions. *(Voice dictation controls currently run in simulated **Preview** mode pending native `cpal` + `whisper-rs` integration.)*
- **Pre-Change Snapshots:** Detects **Timeshift**, **Snapper**, and **Btrfs** subvolumes in **Settings** for on-demand restore points.

---

## 4. Accessibility & Themes

- **Linear Matte Themes:** Switch between solid **Dark** (`#050505` / `#111213`) and **Light** (`#F3F4F6` / `#FFFFFF`) themes from the title bar; choice persists in `ui-theme`.
- **WCAG AA Accessibility:** Keyboard-only focus rings (`:focus-visible`), semantic headings on all views, and live screen-reader announcements (`aria-live="polite"`).
