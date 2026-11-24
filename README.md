<p align="center">
  <img src=".github/assets/logo.png" alt="Agentic Tuneup Pro Logo" width="160">
  <h1 align="center">Agentic Tuneup Pro</h1>
</p>

<p align="center">
  <strong>Safety-first Linux system cleaner, package manager, and performance suite</strong>
</p>

<p align="center">
  <a href="https://github.com/zvirox/agentic-tuneup-pro/releases"><img src="https://img.shields.io/badge/Release-Latest_Packages-blue.svg" alt="Releases" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License" /></a>
  <img src="https://img.shields.io/badge/Platform-Linux_(Wayland_&_X11)-orange.svg" alt="Platform" />
  <img src="https://img.shields.io/badge/Stack-Rust_·_Tauri_2_·_React_19-indigo.svg" alt="Stack" />
</p>

<p align="center">
  <a href="#what-is-agentic-tuneup-pro">What is it?</a> ·
  <a href="#core-safety-principles">Safety Principles</a> ·
  <a href="#key-features">Key Features</a> ·
  <a href="#starship-control-integration">Starship Control Integration</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#frequently-asked-questions">FAQ</a>
</p>

---

## What is Agentic Tuneup Pro?

Agentic Tuneup Pro is an intelligent, safety-first desktop optimizer and system maintenance suite for Linux. Most traditional cleaning utilities run unchecked shell commands that permanently delete files without an undo option. One mistyped path or buggy script can break an entire system installation.

Agentic Tuneup Pro redefines Linux maintenance around verifiable safety. It gives you a clear visual dashboard showing your system health, package statuses, process trees, and disk usage. Files are never deleted permanently during cleanups; instead, they are moved to an encrypted local quarantine where they can be restored at any time with guaranteed byte-for-byte fidelity.

---

## Core Safety Principles

1. **Zero Unquarantined Deletions**: Every cleaned file is moved to a local, reversible quarantine area. If an application needs a removed file, you can restore it with a single click.
2. **Strict Zero-Shell Execution**: All system operations run directly through operating system process calls. The app never runs commands through a bash shell (`sh -c`), eliminating command injection vulnerabilities.
3. **Signed Human Approval Gates**: Low-risk inspections run automatically, but any action that removes packages, halts services, or empties caches pauses and requests your explicit confirmation.
4. **Hard Protected Paths**: System directories (`/etc`, `/boot`, `/usr`), user SSH and GPG keys, and browser credential vaults are completely blocked from deletion by native kernel checks.

---

## Key Features

- **Parallel Multi-Target Disk Cleaner**: Scan and clean browser caches, development build artifacts (such as `target/`, `node_modules/`, and Python virtual environments), and system logs in parallel.
- **Two-Phase Reversible Quarantine**: Restore past cleanup sessions with exact SHA-256 integrity verification. Set retention policies so old quarantined files automatically expire.
- **Unified Package Management**: Manage native package managers (`apt`, `dnf`, `pacman`) alongside Flatpak runtimes in one unified list. Identify orphan dependencies safely.
- **Process & Service Explorer**: View running applications grouped by process tree. Inspect live memory and CPU usage gauges, and gracefully stop runaway background processes.
- **"Why is my PC slow?" Diagnostics**: Automatically correlate CPU saturation, memory pressure, thermal throttling, and background desktop indexers to diagnose system slowdowns.
- **Real-Time System Telemetry**: A smooth 1 Hz monitor provides live CPU, memory, and disk I/O metrics alongside a composite 100-point system health score.
- **Modern Linear-Style Design**: Sleek matte dark surfaces, keyboard navigation shortcuts (`Ctrl+K`), and smooth animations.

---

## Starship Control Integration

Agentic Tuneup Pro works fully as an independent desktop utility. You can scan, clean, and manage your machine without installing any other tools.

To unlock hands-free maintenance, Agentic Tuneup Pro connects directly with **Starship Control**, the unified Linux desktop AI assistant.

### Why It Exists

Keeping a Linux computer fast and clutter-free often involves remembering obscure package flags, tracking down runaway background tasks, and manually inspecting hidden directories. Connecting Agentic Tuneup Pro to Starship Control lets you manage your system using natural conversational queries.

### Real-World Use Cases

- **Intelligent Diagnostics**: Ask Starship Control *"Why is my laptop fan spinning so loud?"* The agent checks CPU temperatures and high-usage background processes, and suggests safe actions.
- **Developer Storage Recovery**: Say *"Find all old build directories in my Projects folder that have not been touched in 30 days and quarantine them to free up disk space."*
- **Scheduled Maintenance**: Set up automated routines: *"Check my package repositories for orphan dependencies every Sunday morning and present a summary for my review."*

### How Connection Works

Setup is completely automatic:

1. **Automatic Discovery**: When Agentic Tuneup Pro starts, it registers its tool catalogue in `$XDG_DATA_HOME/starship/plugins/atp.json`.
2. **Private Local Socket**: Communication flows over a private Unix domain socket at `$XDG_RUNTIME_DIR/starship/bridges/atp.sock`.
3. **Operating System Peer Verification**: Security is enforced using Linux `SO_PEERCRED`. Only applications running under your exact user account can send commands. No web ports are opened, and no diagnostics leave your machine.
4. **Instant Assistant Access**: Summon Starship Control with `Super+Shift+Space`. It immediately recognizes Agentic Tuneup Pro and is ready to diagnose and optimize your machine.

---

## Installation

Prebuilt Linux packages are available on the [Releases page](https://github.com/zvirox/agentic-tuneup-pro/releases).

### Debian, Ubuntu, and Pop!_OS (`.deb`)

```bash
sudo apt install ./agentic-tuneup-pro_*_amd64.deb
```

### Fedora, RHEL, and openSUSE (`.rpm`)

```bash
sudo dnf install ./agentic-tuneup-pro-*.x86_64.rpm
```

### Arch Linux and Manjaro (`.pkg.tar.zst`)

```bash
sudo pacman -U ./agentic-tuneup-pro-*-x86_64.pkg.tar.zst
```

### Building From Source

Requirements: Rust stable, Node.js 22+, and standard Linux development libraries (`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `libssl-dev`, `pkg-config`).

```bash
git clone https://github.com/zvirox/agentic-tuneup-pro.git
cd agentic-tuneup-pro
cd app && npm install && npm run build && cd ..
cargo build --release -p agentic-tuneup-pro
```

---

## Frequently Asked Questions

#### Can Agentic Tuneup Pro accidentally break my system?
No. The app uses a strict whitelist of cleanable cache folders and an absolute blacklist for system-critical paths. Furthermore, files are never permanently deleted on the first pass; they are safely quarantined and can be restored at any time.

#### Does Agentic Tuneup Pro require root privileges?
Most everyday operations, like clearing browser caches and developer build artifacts, run with standard user permissions. When an administrative task is required (like managing system-level packages), the app communicates with a tightly scoped helper service that asks for standard Linux authorization.

#### Is Starship Control required to use the cleaner?
No. Agentic Tuneup Pro is a 100% standalone desktop application with its own visual interface and keyboard shortcuts. Starship Control is an optional companion for voice and automated agentic workflows.

#### How do I restore a file that was quarantined?
Open the app, navigate to the Quarantine tab, select the cleanup session or individual file you want back, and click Restore. The file is placed back in its original folder with its original permissions.

---

## License

Agentic Tuneup Pro is open-source software licensed under the [Apache License, Version 2.0](LICENSE).
