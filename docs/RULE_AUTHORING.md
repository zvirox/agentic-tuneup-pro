# Agentic Tuneup Pro — Cleaner Rule Authoring Guide

Agentic Tuneup Pro allows power users and developers to define custom cleaner rules using standard TOML. Custom rules allow ATP to target new application caches, project build artifacts, or package caches safely.

---

## 1. Rule Specification Schema

Each rule is defined in TOML with the following schema:

```toml
[rule]
id = "gradle-cache"
name = "Gradle Build Cache"
category = "Development Artifacts"
description = "Cached dependencies, compiler daemons, and wrapper binaries for Gradle builds"
tier = 2 # 1 = Safe/Read-only, 2 = Reversible/Quarantine, 3 = Destructive

# Base search paths with variable expansion
paths = [
    "$HOME/.gradle/caches",
    "$HOME/.gradle/daemon",
]

# Patterns to include (glob syntax)
patterns = [
    "**/*.lock",
    "**/daemon-*.out.log",
    "**/journal/*",
]

# Patterns to strictly exclude (even if matched above)
exclude_patterns = [
    "**/gradle.properties",
    "**/credentials*",
]

# Process names that block cleaning if currently running
blocking_apps = [
    "gradle",
    "java",
]
```

---

## 2. Supported Path Expansion Tokens

Rule paths support standard environment variables and XDG directory tokens:

| Token | Typical Target Path |
| :--- | :--- |
| `$HOME` or `~` | Current user home directory (`/home/<user>`) |
| `$XDG_CACHE_HOME` | User cache directory (`$HOME/.cache`) |
| `$XDG_CONFIG_HOME` | User configuration directory (`$HOME/.config`) |
| `$XDG_DATA_HOME` | User data directory (`$HOME/.local/share`) |

---

## 3. Risk Tiers & Safety Invariants

- **Tier 1 (Safe)**: Temporary files with no runtime impact (e.g. system thumbnails, stale download fragments).
- **Tier 2 (Reversible Mutation)**: Application caches and stale build outputs. All deletions are automatically moved to the **Quarantine Vault** with instant undo support.
- **Tier 3 (Destructive)**: Package removals or global configuration resets. Gated by explicit user confirmation and pre-change snapshot creation.

> **Hard Safety Invariant**: The path validator will automatically block any rule that targets protected paths (such as `~/.ssh`, browser passwords, or `/etc`), regardless of what is specified in the rule file.

---

## 4. Registering Custom Rules

Place custom `.toml` rule files in:
```bash
~/.config/agentic-tuneup-pro/rules/
```

Agentic Tuneup Pro automatically discovers and validates custom rules upon startup or when **Rescan** is clicked.
