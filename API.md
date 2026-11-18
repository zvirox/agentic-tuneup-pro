# API.md — Agentic Tuneup Pro IPC & Protocol Contracts

**Version:** 1.0 · **Date:** 2026-11-18  
**Status:** Protocol & IPC Law  
**Authority chain:** `PRD.md` (Product Requirements) → `ARCHITECTURE.md` (Process Boundaries) → `DESIGN.md` (UI Law) → **this file (Typed Contracts, Commands, Events, MCP Wire Protocol)** → `PLAN.md` (Roadmap)  
**Rule:** Defines all typed request/response Tauri IPC commands, real-time push events, canonical error envelopes, and the Starship Control MCP JSON-RPC 2.0 wire protocol. No product code is written as part of this document.

---

## 1. Standard Error Envelope Schema

Every error returned by an IPC command or emitted over an event stream strictly conforms to this JSON structure (harmonized with Starship Control):

```json
{
  "kind": "cleaner",
  "code": "cleaner.protected_path_violation",
  "retryable": false,
  "userMessage": "Attempted to scan or clean a protected system directory or credential store. This operation was blocked by safety policy.",
  "details": {
    "attemptedPath": "/home/zvirox/.config/google-chrome/Default/Login Data",
    "blockedBy": "protected.browser_passwords"
  }
}
```

### 1.1 Envelope Fields
| Field | Type | Description |
|---|---|---|
| `kind` | `string` | Error family: `'cleaner'`, `'pkg'`, `'monitor'`, `'safety'`, `'mcp'`, `'helper'`, `'ipc'`. |
| `code` | `string` | Stable, machine-readable identifier in dot notation (`<domain>.<cause>`). |
| `retryable` | `boolean` | Indicates whether the UI should provide an immediate Retry action. |
| `userMessage` | `string` | Human-readable explanation formatted from DESIGN.md vocabulary. Raw system logs stay on disk. |
| `details` | `object \| null` | Structured metadata (paths, PIDs, package names, exit codes, D-Bus errors). |

### 1.2 Canonical Error Codes
- **Cleaner (`cleaner.*`):** `cleaner.rule_parse_failed`, `cleaner.scan_in_progress`, `cleaner.scan_aborted`, `cleaner.protected_path_violation`, `cleaner.quarantine_failed`, `cleaner.restore_destination_occupied`, `cleaner.session_not_found`, `cleaner.browser_running`.
- **Package Management (`pkg.*`):** `pkg.backend_unavailable`, `pkg.package_not_found`, `pkg.dependency_conflict`, `pkg.lock_held`, `pkg.orphan_detection_failed`, `pkg.execution_failed`.
- **System Monitoring (`monitor.*`):** `monitor.sensor_read_failed`, `monitor.process_not_found`, `monitor.sampling_loop_lag`.
- **Safety & Privileges (`safety.*`):** `safety.approval_rejected`, `safety.permission_denied`, `safety.invalid_signature_token`, `safety.tier_violation`, `safety.audit_write_failed`.
- **Helper & Polkit (`helper.*`):** `helper.dbus_unavailable`, `helper.polkit_auth_failed`, `helper.validation_rejected`, `helper.daemon_timeout`.
- **MCP Bridge (`mcp.*`):** `mcp.socket_unreachable`, `mcp.so_peercred_failed`, `mcp.tool_not_found`, `mcp.lease_timeout`, `mcp.invalid_arguments`.

---

## 2. Tauri IPC Commands (`cmd://...`)

Commands invoked by the React frontend via Tauri's `invoke("command_name", payload)`.

### 2.1 System Telemetry & Health

#### `cmd://telemetry_get_snapshot`
Fetches a single instantaneous telemetry frame across all hardware subsystems.
* **Payload:** `{}`
* **Success Output:**
  ```json
  {
    "timestamp": 1731924300,
    "cpu": {
      "aggregateUsagePercent": 24.2,
      "coreCount": 8,
      "coreUsages": [28.1, 22.0, 31.4, 19.8, 25.0, 21.2, 23.5, 22.6],
      "frequencyMhz": 3400,
      "temperatureCelsius": 48.0
    },
    "memory": {
      "totalBytes": 17179869184,
      "usedBytes": 6657199308,
      "availableBytes": 10522669876,
      "swapTotalBytes": 8589934592,
      "swapUsedBytes": 0
    },
    "disk": {
      "mountPoint": "/",
      "totalBytes": 549755813888,
      "usedBytes": 335007446466,
      "readBytesPerSec": 125829120,
      "writeBytesPerSec": 35651584
    },
    "network": {
      "interfaceName": "wlp3s0",
      "downloadBytesPerSec": 4404019,
      "uploadBytesPerSec": 629145
    }
  }
  ```

#### `cmd://health_get_score`
Returns the algorithmic 0–100 System Health Score with itemized deductions.
* **Payload:** `{}`
* **Success Output:**
  ```json
  {
    "score": 86,
    "rating": "good",
    "deductions": [
      {
        "category": "junk",
        "points": 8,
        "reason": "4.2 GB of reclaimable junk detected in system and browser caches",
        "actionLabel": "Clean Junk",
        "targetPage": "clean"
      },
      {
        "category": "updates",
        "points": 6,
        "reason": "12 package updates pending across Flatpak and apt",
        "actionLabel": "View Updates",
        "targetPage": "apps"
      }
    ]
  }
  ```

---

### 2.2 Cleaner & Quarantine Subsystem

#### `cmd://cleaner_scan`
Triggers an asynchronous scan across specified or all active cleaner rule categories.
* **Payload:**
  ```json
  {
    "categories": ["system", "browser", "package_cache", "dev"]
  }
  ```
* **Success Output:** `{"jobId": "scan_8f3a9e"}`
* **Events Emitted:** `evt://cleaner/scan_progress` $\to$ `evt://cleaner/scan_complete`

#### `cmd://cleaner_get_active_scan`
Retrieves the full results tree of the latest completed disk scan.
* **Payload:** `{}`
* **Success Output:**
  ```json
  {
    "totalReclaimableBytes": 4509715660,
    "categories": [
      {
        "categoryId": "browser",
        "displayName": "Web Browsers",
        "reclaimableBytes": 1415577600,
        "fileCount": 890,
        "rules": [
          {
            "ruleId": "chrome-cache",
            "name": "Chrome Cache",
            "description": "Temporary cached web images and scripts. Chrome rebuilds them as needed.",
            "requiresClosed": ["google-chrome", "chrome"],
            "riskTier": 2,
            "reclaimableBytes": 794820608,
            "fileCount": 540,
            "samplePaths": [
              "/home/zvirox/.cache/google-chrome/Default/Cache/data_0",
              "/home/zvirox/.cache/google-chrome/Default/Cache/data_1"
            ]
          }
        ]
      }
    ]
  }
  ```

#### `cmd://cleaner_execute_clean`
Moves selected rule targets into the versioned quarantine store.
* **Payload:**
  ```json
  {
    "selectedRuleIds": ["chrome-cache", "system-tmp", "stale-node-modules"],
    "createSnapshot": false
  }
  ```
* **Success Output:**
  ```json
  {
    "sessionId": "q_20261118_104500_8f3a",
    "status": "quarantined",
    "bytesFreed": 4509715660,
    "filesCount": 1420,
    "quarantinePath": "/home/zvirox/.local/share/agentic-tuneup-pro/quarantine/q_20261118_104500_8f3a"
  }
  ```
* **Errors:** `cleaner.browser_running`, `cleaner.protected_path_violation`.

#### `cmd://cleaner_restore_quarantine`
Instant Undo: Atomically restores a quarantined session's files back to original paths.
* **Payload:**
  ```json
  {
    "sessionId": "q_20261118_104500_8f3a"
  }
  ```
* **Success Output:**
  ```json
  {
    "sessionId": "q_20261118_104500_8f3a",
    "status": "restored",
    "filesRestored": 1420
  }
  ```
* **Errors:** `cleaner.session_not_found`, `cleaner.restore_destination_occupied`.

#### `cmd://cleaner_purge_quarantine`
Permanently deletes quarantined files for a specific session or older than N days.
* **Payload:**
  ```json
  {
    "sessionId": "q_20261118_104500_8f3a",
    "signatureToken": "usr_sig_99a8b12"
  }
  ```
* **Success Output:** `{"purged": true, "bytesDeleted": 4509715660}`

---

### 2.3 Package & App Manager

#### `cmd://pkg_list_installed`
Lists all installed packages across enabled backends (Flatpak, Native, AppImage).
* **Payload:** `{"backendFilter": null}`
* **Success Output:**
  ```json
  {
    "packages": [
      {
        "id": "org.mozilla.firefox",
        "name": "Firefox",
        "version": "132.0.2",
        "backend": "flatpak",
        "summary": "Fast, Private & Safe Web Browser",
        "sizeBytes": 245000000,
        "isUpdatable": true
      },
      {
        "id": "ripgrep",
        "name": "ripgrep",
        "version": "14.1.0",
        "backend": "pacman",
        "summary": "Line-oriented search tool",
        "sizeBytes": 5400000,
        "isUpdatable": false
      }
    ]
  }
  ```

#### `cmd://pkg_audit_orphans`
Scans for orphaned dependencies and unused runtimes.
* **Payload:** `{}`
* **Success Output:**
  ```json
  {
    "totalOrphanBytes": 1184890880,
    "orphans": [
      {
        "id": "org.gnome.Platform//45",
        "name": "GNOME Platform 45",
        "backend": "flatpak",
        "reason": "Unused runtime (no installed Flatpaks reference this version)",
        "sizeBytes": 817889280
      },
      {
        "id": "libgtk2.0-0",
        "name": "libgtk2.0-0",
        "backend": "apt",
        "reason": "Installed as dependency, 0 reverse dependencies remaining",
        "sizeBytes": 14680064
      }
    ]
  }
  ```

#### `cmd://pkg_prepare_action`
Generates an execution plan and dependency diff before any install, removal, or update.
* **Payload:**
  ```json
  {
    "actionType": "remove",
    "backend": "flatpak",
    "packageId": "org.gnome.Platform//45"
  }
  ```
* **Success Output:**
  ```json
  {
    "planId": "pkg_plan_441",
    "actionType": "remove",
    "riskTier": 3,
    "targetPackage": "org.gnome.Platform//45",
    "affectedPackages": ["org.gnome.Platform//45"],
    "downloadBytes": 0,
    "diskDeltaBytes": -817889280,
    "requiresPolkit": false
  }
  ```

#### `cmd://pkg_execute_plan`
Executes an approved plan through the package engine or Polkit helper.
* **Payload:**
  ```json
  {
    "planId": "pkg_plan_441",
    "signatureToken": "usr_sig_4482b"
  }
  ```
* **Success Output:** `{"status": "completed", "exitCode": 0}`

---

### 2.4 Processes, Services & Autostart

#### `cmd://proc_list`
Lists running processes grouped by application with resource metrics.
* **Payload:** `{"sortBy": "cpu", "limit": 25}`
* **Success Output:**
  ```json
  {
    "processes": [
      {
        "pid": 3120,
        "name": "firefox",
        "displayName": "Firefox (34 processes)",
        "cpuPercent": 24.1,
        "memoryBytes": 1932735283,
        "ioReadBytesPerSec": 2097152,
        "isCritical": false
      }
    ]
  }
  ```

#### `cmd://proc_kill`
Terminates a process or entire process tree.
* **Payload:**
  ```json
  {
    "pid": 3120,
    "killTree": true,
    "signal": 15,
    "signatureToken": "usr_sig_proc_3120"
  }
  ```
* **Success Output:** `{"terminated": true}`
* **Errors:** `safety.permission_denied`, `monitor.process_not_found`.

#### `cmd://service_list`
Lists systemd user and system services via `zbus`.
* **Payload:** `{"scope": "user"}`
* **Success Output:**
  ```json
  {
    "services": [
      {
        "unitName": "pipewire.service",
        "description": "PipeWire Multimedia Service",
        "loadState": "loaded",
        "activeState": "active",
        "subState": "running",
        "isUserUnit": true
      }
    ]
  }
  ```

#### `cmd://startup_set_enabled`
Enables or disables an autostart desktop entry.
* **Payload:**
  ```json
  {
    "entryName": "discord.desktop",
    "enabled": false
  }
  ```
* **Success Output:** `{"updated": true}`

---

### 2.5 In-App Agent & Task Planning

#### `cmd://agent_send_prompt`
Dispatches a user prompt or question to the in-app agent companion.
* **Payload:**
  ```json
  {
    "prompt": "Free up 5 GB of disk space and check why my machine is running hot"
  }
  ```
* **Success Output:** `{"status": "planning", "requestId": "req_108"}`
* **Events Emitted:** `evt://agent/thought_stream` $\to$ `evt://agent/plan_ready`

#### `cmd://agent_approve_step`
User signs approval for a proposed Tier 2 or Tier 3 task step.
* **Payload:**
  ```json
  {
    "requestId": "req_108",
    "stepIndex": 1,
    "signatureToken": "usr_sig_ag_step_1"
  }
  ```
* **Success Output:** `{"status": "executing"}`

#### `cmd://agent_abort`
Immediately halts running agent tasks and drops locks.
* **Payload:** `{"requestId": "req_108"}`
* **Success Output:** `{"aborted": true}`

---

## 3. Real-Time Push Events (`evt://...`)

Events emitted from the Rust backend to the Tauri webview via `app.emit("event_name", payload)`.

### 3.1 `evt://telemetry/tick`
Broadcast at 1.0 Hz with fresh machine telemetry.
```json
{
  "cpuPercent": 24.2,
  "memUsedBytes": 6657199308,
  "tempCelsius": 48.0,
  "netDownBytes": 4404019,
  "netUpBytes": 629145
}
```

### 3.2 `evt://cleaner/scan_progress`
Broadcast during multi-threaded file walking.
```json
{
  "filesScanned": 14208,
  "currentPath": "/home/zvirox/.cache/thumbnails",
  "bytesFound": 1248000000
}
```

### 3.3 `evt://agent/plan_approval_needed`
Emitted when an agent step requires explicit human consent.
```json
{
  "requestId": "req_108",
  "stepIndex": 1,
  "toolName": "pkg.purge_orphans",
  "riskTier": 3,
  "actionTitle": "Purge 4 Orphan Packages",
  "diffSummary": "Frees 1.1 GB disk space (0 reverse dependencies)",
  "affectedItems": ["org.gnome.Platform//44", "libgtk2.0-0"]
}
```

### 3.4 `evt://bridge/client_state`
Pushed when Starship Control connects or disconnects from the Unix bridge.
```json
{
  "clientType": "starship_control",
  "state": "connected",
  "peerPid": 48201
}
```

---

## 4. Starship MCP Wire Contract

Communication between **Starship Control** and ATP runs over **Unix Domain Sockets** (`atp.sock`) or **stdio** (`--mcp`) using standard **JSON-RPC 2.0**.

### 4.1 Handshake (`starship/hello`)
Immediately upon socket connection, Starship Control negotiates capabilities:

* **Request (Starship Control $\to$ ATP):**
  ```json
  {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "starship/hello",
    "params": {
      "starshipVersion": "1.0.0",
      "supportedMcpVersion": "2024-11-05"
    }
  }
  ```

* **Response (ATP $\to$ Starship Control):**
  ```json
  {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "appId": "atp",
      "name": "Agentic Tuneup Pro",
      "version": "0.1.0",
      "tools": [
        {
          "name": "tuneup.get_health",
          "description": "Returns System Health Score (0-100), telemetry status, and storage breakdown",
          "riskTier": 1,
          "parameters": {
            "type": "object",
            "properties": {}
          }
        },
        {
          "name": "tuneup.scan_junk",
          "description": "Scans system, browser, package, and dev caches; returns reclaimable bytes",
          "riskTier": 1,
          "parameters": {
            "type": "object",
            "properties": {
              "categories": {
                "type": "array",
                "items": {"type": "string", "enum": ["system", "browser", "package_cache", "dev"]}
              }
            }
          }
        },
        {
          "name": "tuneup.clean_junk",
          "description": "Moves selected rule targets to quarantine. Generates an undo session ID.",
          "riskTier": 2,
          "parameters": {
            "type": "object",
            "properties": {
              "ruleIds": {
                "type": "array",
                "items": {"type": "string"}
              }
            },
            "required": ["ruleIds"]
          }
        },
        {
          "name": "tuneup.restore_quarantine",
          "description": "Restores a previous quarantine session's files back to original paths",
          "riskTier": 2,
          "parameters": {
            "type": "object",
            "properties": {
              "sessionId": {"type": "string"}
            },
            "required": ["sessionId"]
          }
        },
        {
          "name": "tuneup.list_orphans",
          "description": "Scans package managers for unused dependencies and flatpak runtimes",
          "riskTier": 1,
          "parameters": {
            "type": "object",
            "properties": {}
          }
        },
        {
          "name": "tuneup.purge_orphans",
          "description": "Removes unused package dependencies and unused Flatpak runtimes (Root action)",
          "riskTier": 3,
          "parameters": {
            "type": "object",
            "properties": {
              "backend": {"type": "string", "enum": ["flatpak", "native", "all"]}
            },
            "required": ["backend"]
          }
        },
        {
          "name": "tuneup.list_processes",
          "description": "Lists running processes sorted by resource consumption",
          "riskTier": 1,
          "parameters": {
            "type": "object",
            "properties": {
              "sortBy": {"type": "string", "enum": ["cpu", "memory", "disk"]},
              "limit": {"type": "integer"}
            }
          }
        },
        {
          "name": "tuneup.kill_process",
          "description": "Terminates a runaway process or process tree",
          "riskTier": 3,
          "parameters": {
            "type": "object",
            "properties": {
              "pid": {"type": "integer"},
              "killTree": {"type": "boolean"}
            },
            "required": ["pid"]
          }
        }
      ]
    }
  }
  ```

---

### 4.2 Tool Invocation (`tools/call`)

* **Request (Starship Control $\to$ ATP):**
  ```json
  {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "tuneup.clean_junk",
      "arguments": {
        "ruleIds": ["chrome-cache", "system-tmp"]
      },
      "leaseTimeoutMs": 15000
    }
  }
  ```

* **Response (ATP $\to$ Starship Control):**
  ```json
  {
    "jsonrpc": "2.0",
    "id": 2,
    "result": {
      "status": "success",
      "sessionId": "q_20261118_104500_8f3a",
      "bytesReclaimed": 2147483648,
      "filesMoved": 642,
      "quarantinePath": "/home/zvirox/.local/share/agentic-tuneup-pro/quarantine/q_20261118_104500_8f3a",
      "undoAvailable": true
    }
  }
  ```

---

### 4.3 Task Cancellation (`tools/cancel`)
If the user hits emergency abort on the Starship HUD or Cockpit:

* **Request:**
  ```json
  {
    "jsonrpc": "2.0",
    "method": "tools/cancel",
    "params": {
      "callId": 2,
      "reason": "user_cancelled"
    }
  }
  ```
* **ATP Behavior:** Immediately aborts file iteration or package transactions, cleans up temporary lock files, and drops running tasks.

---

*Authored by Zvirox — Cyber Defender · Part of the Mother Ship Suite.*
