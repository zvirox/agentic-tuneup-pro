# Agentic Tuneup Pro — Safety & Security Manifesto

Safety is not a feature in Agentic Tuneup Pro; it is the mathematical foundation of the entire architecture. This document outlines the guarantees, risk models, privilege boundaries, and cryptographic verification mechanisms protecting user systems.

---

## 1. The 3-Tier Risk Model

Every action executed by a user or an autonomous Starship agent is classified into an explicit risk tier:

| Tier | Classification | Behavior & Verification | Example Actions |
| :--- | :--- | :--- | :--- |
| **Tier 1** | **Safe / Read-Only** | Auto-executable without prompts. No state alteration. | Hardware telemetry polling, cleaner scanning, service status inspect. |
| **Tier 2** | **Reversible Mutation** | Staged to quarantine vault. Supported by sub-second instant undo. | Clearing application caches, deleting stale build artifacts, vacuuming logs. |
| **Tier 3** | **Destructive / Irreversible** | Requires pre-change snapshot and explicit modal user confirmation. | Package purge, orphan removal, killing system process trees. |

---

## 2. Hard Protected Path Boundary

Even if a custom cleaner rule or rogue agent prompt instructs the cleaner to scan or delete sensitive files, `atp-safety` enforces a hard-coded path validator that rejects the operation before any filesystem touch occurs:

### Strictly Blacklisted Targets:
1. **Credentials & Password Vaults**:
   - `**/Login Data*` (Chromium / Chrome / Brave password stores)
   - `**/logins.json` (Firefox encrypted password store)
   - `**/key4.db`, `**/cert9.db` (NSS security databases)
   - `**/credentials`, `**/secrets`
2. **Identity & Cryptographic Keys**:
   - `~/.ssh/**` (Private SSH keys, `id_rsa`, `authorized_keys`, `known_hosts`)
   - `~/.gnupg/**` (GPG secret keyrings, trust databases)
   - `~/.pki/**`, `**/keyrings/**`
3. **Core Operating System Hierarchies**:
   - `/etc/**` (System configuration)
   - `/boot/**` (Kernel images, GRUB/systemd-boot loaders)
   - `/usr/**`, `/bin/**`, `/sbin/**` (System binaries and libraries)
   - `/dev/**`, `/proc/**`, `/sys/**` (Kernel virtual filesystems)

### Traversal & Symlink Dereference Prevention
- Paths are canonicalized using `std::fs::canonicalize` to resolve all relative segments (`..`).
- Symlinks targeting paths outside the user-approved scope are rejected.

---

## 3. The Non-Destructive Quarantine Store

Unlike conventional tools that invoke `rm -rf`, Agentic Tuneup Pro stages deletions to an isolated, structured quarantine store:

```
$XDG_DATA_HOME/agentic-tuneup-pro/quarantine/
└── q_20261122_091530_4a9b/
    ├── manifest.json
    └── payload/
        ├── home/zvirox/.cache/google-chrome/Default/Cache/data_0
        └── ...
```

### Manifest Integrity (`manifest.json`):
- **Original Path**: Absolute path where the file resided.
- **File Metadata**: Permissions (UNIX mode), ownership, and timestamps.
- **Cryptographic Hash**: SHA-256 digest recorded prior to moving.
- **Atomicity**: Files are moved using filesystem `rename` (or chunked copy on cross-filesystem boundaries) so they can be restored in under 200 ms with verified byte parity.

---

## 4. Privileged Polkit Helper Daemon (`atpd-helper`)

Desktop user interfaces must never run as `root`. Agentic Tuneup Pro enforces strict privilege separation:

```
[ GUI App (User: 1000) ]
        │
        │ System D-Bus: in.zvirox.AgenticTuneupHelper
        ▼
[ Polkit Authorization Gate (PolicyKit) ]
        │ (Prompts root password only when needed)
        ▼
[ Helper Daemon: /usr/libexec/atpd-helper (Root) ]
        ├── PkgManager::remove_orphans()
        ├── Systemd::restart_unit()
        └── Journal::vacuum()
```

- Zero direct shell execution: All helper functions execute strictly typed system commands (`std::process::Command`) without invoking shell interpreters (`sh`, `bash`), preventing command injection attacks.
- Granular Polkit actions: Policies in `/usr/share/polkit-1/actions/in.zvirox.agentic_tuneup.policy` define fine-grained permissions for specific maintenance tasks.

---

## 5. Tamper-Evident SQLite Audit Trail

Every system mutation, agent decision, quarantine session, and undo operation is written to an immutable SQLite database at `$XDG_DATA_HOME/agentic-tuneup-pro/audit.db`:
- Write-Ahead Logging (WAL) enabled for durability.
- Restricted `0600` file permissions.
- Cryptographic hash chaining ensures the audit log cannot be retroactively modified without detection.
- Complete visual inspection timeline available in the **Settings & Audit Trail** view.
