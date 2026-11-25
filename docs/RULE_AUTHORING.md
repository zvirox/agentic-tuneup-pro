# Agentic Tuneup Pro — Cleaner Rule Authoring Guide

Agentic Tuneup Pro lets power users and developers define custom cleaner rules using TOML files validated by `atp-cleaner` and `atp-safety`.

---

## 1. Exact TOML Schema (`atp-cleaner/src/rule.rs`)

Each rule file contains one or more `[[rule]]` array entries matching the Rust `CleanerRule` struct:

```toml
[[rule]]
id = "gradle-cache"
name = "Gradle Build Cache"
category = "dev"
description = "Cached dependencies, compiler daemons, and wrapper logs for Gradle builds"
paths = [
    "~/.gradle/caches/**",
    "~/.gradle/daemon/**",
]
requires_closed = ["gradle", "java"]
risk_tier = 2 # 1 = Safe, 2 = Reversible Quarantine, 3 = Destructive
explanation = "Gradle rebuilds local caches cleanly from project build files on next run."
```

### Field Reference
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier for the rule (`kebab-case`). |
| `name` | `string` | Human-readable rule label shown in `CategoryTree`. |
| `category` | `string` | Grouping category (`system`, `browser`, `package_cache`, `dev`, `app`). |
| `description` | `string` | Short summary of what files are matched. |
| `paths` | `string[]` | Glob patterns (`~` expands to user home directory). |
| `requires_closed` | `string[]` | Optional list of process names that pause/block the rule while running. |
| `risk_tier` | `u8` | `1` (Safe), `2` (Reversible Quarantine), or `3` (Destructive). |
| `explanation` | `string` | Plain-English explanation of why clearing these paths is safe. |

---

## 2. Hard Protected Path Invariant

Before any rule is accepted or scanned, `RuleEngine` passes its expanded paths through `ProtectedValidator::validate`:
- **Browser Credential Vaults:** `Login Data*`, `logins.json`, `key4.db`, `cert9.db`.
- **Cryptographic Identity Keys:** `~/.ssh/**`, `~/.gnupg/**`, `~/.local/share/keyrings/**`, `~/.pki/**`.
- **Root OS Hierarchies (Component-Aware):** `/etc/**`, `/boot/**`, `/usr/**`, `/bin/**`, `/sbin/**`, `/dev/**`, `/proc/**`, `/sys/**`, `/var/lib/**`.

Any rule attempting to target or symlink into protected locations fails validation with `safety.protected_path_violation`.

---

## 3. Registering Custom Rules

Place custom `.toml` rule files in:

```bash
~/.config/agentic-tuneup-pro/rules/
```

ATP automatically merges user-defined rules with its built-in embedded rules on startup and whenever **Rescan** is clicked.
