# Agentic Tuneup Pro (ATP)

**Status:** Planning Phase · **Platform:** Linux (Wayland / X11)  
**Parent Ecosystem:** [Mother Ship / Starship Control](https://github.com/zvirox/starship-control)

---

## 1. Overview

**Agentic Tuneup Pro (ATP)** is a native Linux system cleaner, performance optimizer, and package maintenance utility designed from the ground up for agentic automation and human-supervised control.

ATP detects, analyzes, and reclaims disk space across system and user caches (pacman, dnf, apt, flatpak, cargo, docker, thumbnails, and temp files), identifies orphaned dependencies, and monitors machine resource health.

### Ecosystem Integration: Starship Control
ATP natively embeds the **`starship-plugin` SDK**, publishing its manifest at `$XDG_DATA_HOME/starship/plugins/atp.json` and exposing an authenticated Unix domain socket bridge at `$XDG_RUNTIME_DIR/starship/bridges/atp.sock`.

Through this bridge, **Starship Control** can:
1. Query system storage and cache bloat autonomously (Tier 1 Safe).
2. Formulate cleanup task sheets (`tasksheet/1`).
3. Safely purge caches and remove orphaned packages upon human approval (Tier 3 Destructive Gate).

---

## 2. Core Capabilities

- **Multi-Package Cache Manager:** Cleans package manager caches (Arch/pacman, Debian/apt, Fedora/dnf, Flatpak, Snap).
- **Developer Artifact Cleaner:** Scans and safely prunes `target/`, `node_modules/`, `.cache/`, Docker dangling images, and Python virtualenvs.
- **Orphan Dependency Auditor:** Highlights unneeded packages and libraries with zero reverse dependencies.
- **Tier 3 Safety Enforced:** No files or packages are ever removed silently. Every mutation generates an exact preview diff requiring signed human authorization on Starship Control's Cockpit or Floating HUD.

---

## 3. Tech Stack

- **Backend Daemon:** Rust 2024 + Tokio (`atpd`)
- **Desktop Shell:** Tauri 2 + React 19 + Tailwind CSS v4 (frosted glass matching the suite)
- **Agent Protocol:** Model Context Protocol (MCP) JSON-RPC 2.0 via `starship-plugin`
- **Transport:** Linux Unix Domain Sockets (`SO_PEERCRED` validation) and stdio CLI (`atp --mcp`)

---

## 4. Planned Milestones

- **Phase 0:** Workspace scaffolding (`atp-core`, `atp-cli`, `atpd`, `app/`).
- **Phase 1:** Cache analyzers & reclaim engine (pacman/apt/dnf/flatpak).
- **Phase 2:** Developer disk scanner (`cargo`, `node_modules`, `pip`).
- **Phase 3:** `starship-plugin` SDK integration & MCP server surface.
- **Phase 4:** Tauri 2 frosted-glass desktop UI & Floating HUD companion.
