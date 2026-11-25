# AGENTS.md — Agentic Tuneup Pro Engineering & Design Contract

This document defines mandatory invariants for contributors and coding agents working in `agentic-tuneup-pro`.

---

## 1. Locked Linear Design System (Final — No UI Style Changes)

The **Linear-Style Solid Matte UI** is **FINAL and LOCKED**. Do not re-introduce frosted glass, blur, translucency, or dark-mode shadows anywhere.

- **Surfaces:** Flat, solid, opaque surfaces with `1px` hairline borders (`--bg-app`, `--bg-surface`, `--bg-surface-2`, `--bg-bar-idle`, `--border`, `--border-strong`).
- **Strictly Forbidden:** `backdrop-filter`, `backdrop-blur-*`, translucent fills (`bg-white/*`, `bg-black/*`, `rgba(...)`, `hsla(...)`), glow effects, dark-theme `box-shadow`, surface gradients (gradient fades allowed *only* under chart lines/sparklines), raw hex colors outside token files (`app/src/tailwind.css` and `app/src/components/linear/echarts-linear-theme.ts`), and pill-shaped cards/chips (`rounded-full` is restricted strictly to status dots, avatars, and donut arc ends).
- **Window & Title Bar:** Wide 16:10 window (`1280×800` default, `1024×640` minimum, `decorations: false`, `transparent: false`, `shadow: true`). Identical `40px` `TitleBar` reading version from `app/src-tauri/tauri.conf.json`, with right-side theme toggle (`ui-theme` in `localStorage`), minimize, maximize/restore, and `#E5484D` hover close. Never add macOS-style traffic lights.
- **Typography:** Self-hosted `@fontsource/inter` only for UI text (`12 / 13 / 14 / 16 / 20 / 28 px`, `tabular-nums` for stats). Monospace restricted to log/code/path payloads. Keep `html { font-size: 16px; }` so Tailwind `rem` dimensions match exact pixel contracts (`TitleBar = 40px`, `Sidebar = 240px / 56px`, nav items `36px`).
- **Required Gate:** Run `npm --prefix app run check:linear && npm --prefix app run build` before any UI change is considered complete.

---

## 2. Core Safety & Engineering Invariants

1. **Zero Unquarantined Deletions:** Cleanup actions (`atp-cleaner`) must stage targets via `QuarantineStore` (`atp-safety`) with SHA-256 verification and instant Undo.
2. **Zero-Shell Execution:** Never use `sh -c` or shell interpolation. Spawn processes directly via `std::process::Command::new(binary).args([...])`.
3. **Hard Protected Boundary:** `ProtectedValidator` must block browser credential stores (`Login Data*`, `logins.json`, `key4.db`, `cert9.db`), identity keys (`~/.ssh`, `~/.gnupg`, `keyrings`), and whole-component OS roots (`/etc`, `/boot`, `/usr`, `/dev`, `/proc`, `/sys`).
4. **Honest IPC & Errors:** Inside Tauri (`__TAURI_INTERNALS__ in window`), `safeInvoke` must strictly propagate real backend errors. Never mask failures with fake mock successes.
5. **Bounded MCP Signals:** `atp-mcp` `tuneup.kill_process` must validate `pid > 1 && pid <= i32::MAX`, route through `ProcessManager::send_signal`, and record an audit row.
6. **Locked Release Packaging:** Distribution binaries are built exclusively via `packaging/nfpm.yaml` (`.deb`, `.rpm`, `.pkg.tar.zst` + `SHA256SUMS`). AppImage, Flatpak, tarballs, and AUR recipes are retired.

---

## 3. Verification Commands

```bash
npm --prefix app run check:linear
npm --prefix app run build
cargo fmt --all -- --check
cargo clippy --workspace --all-targets
cargo test --workspace
```
