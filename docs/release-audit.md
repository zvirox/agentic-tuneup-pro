# Release & Packaging Audit — Agentic Tuneup Pro

**Audited:** 2026-11-24  
**Auditor:** Prakash / Antigravity  
**Repository:** `agentic-tuneup-pro` (`https://github.com/zvirox/agentic-tuneup-pro`)

---

## 1. Workflows in `.github/workflows/`

* **`.github/workflows/` Directory:** Currently **None** (no CI or release workflows exist in git).
* All previous releases were generated manually or off-line.

---

## 2. Existing Packaging Files & Configuration

* **`app/src-tauri/tauri.conf.json`**:
  * `"bundle": { "active": true, "targets": ["appimage", "deb", "rpm"], ... }`
  * Bundles custom polkit action, systemd unit, and D-Bus conf into `/usr/share/` and `/usr/lib/`.
* **`packaging/` directory contents:**
  * `packaging/agentic-tuneup-pro.desktop`
  * `packaging/atpd-helper.service` (systemd unit for privileged helper)
  * `packaging/in.zvirox.agentic_tuneup.policy` (polkit-1 action policy)
  * `packaging/in.zvirox.AgenticTuneupHelper.conf` (D-Bus system bus configuration)
  * `packaging/in.zvirox.agentictuneuppro.metainfo.xml`
  * `packaging/in.zvirox.agentictuneuppro.svg`, `{32x32,64x64,128x128}.png`
  * `packaging/deb/control`, `postinst`, `prerm`, `postrm`
  * `packaging/rpm/agentic-tuneup-pro.spec`
  * `packaging/flatpak/in.zvirox.AgenticTuneupPro.yaml`
  * `packaging/aur/agentic-tuneup-pro.install`, `PKGBUILD`, `.SRCINFO`
  * `packaging/appimage/AppRun`

---

## 3. Existing Tags and Release Assets

* **Tags:** `v0.0.1-alpha`, `v0.0.2-alpha`, `v0.0.3-alpha`, `v0.0.4-alpha`
* **Latest Release (`v0.0.4-alpha`):**
  * `SHA256SUMS` (677 B)
  * `agentic-tuneup-pro_0.0.4-alpha_amd64.deb` (5.61 MiB)
  * `agentic-tuneup-pro-0.0.4-alpha.x86_64.rpm` (4.39 MiB)
  * `agentic-tuneup-pro-bin-0.0.4.alpha-1-x86_64.pkg.tar.zst` (5.03 MiB)
  * `agentic-tuneup-pro-0.0.4-alpha-x86_64.tar.gz` (5.59 MiB)
  * `agentic-tuneup-pro-aur-0.0.4-alpha.tar.gz` (1.44 KiB)
  * `agentic-tuneup-pro-flatpak-0.0.4-alpha.tar.gz` (2.89 KiB)

---

## 4. Version Alignment Check

| Location | Version | Matches Latest Tag (`v0.0.4-alpha`)? |
|---|---|---|
| `Cargo.toml` (workspace) | `0.1.0` | **Mismatch** (Project manifest is `0.1.0`, tags are `v0.0.4-alpha`) |
| `app/package.json` | `0.1.0` | **Mismatch** (UI manifest is `0.1.0`) |
| `app/src-tauri/tauri.conf.json` | `0.1.0` | **Mismatch** (Tauri config is `0.1.0`) |

*Note: The upcoming planned release will align manifests and tags under semver (e.g., `v0.1.0-alpha.5` or `v0.1.0`).*

---

## 5. Naming Matrix & Identifier Alignment

* **GitHub Repository Name:** `agentic-tuneup-pro`
* **Cargo Binary Name:**
  * GUI App: `agentic-tuneup-pro` (`app/src-tauri/Cargo.toml`)
  * Daemon Helper: `atpd-helper` (`crates/atpd-helper/Cargo.toml`)
* **Tauri `productName`:** `"Agentic Tuneup Pro"`
* **Tauri Identifier:** `in.zvirox.agentictuneuppro`
* **Desktop File:** `packaging/agentic-tuneup-pro.desktop`
* **Icon Name:** `packaging/in.zvirox.agentictuneuppro.png` -> should standardize to `packaging/icons/hicolor/.../agentic-tuneup-pro.png`
* **Mismatch Assessment:**
  - Repo name and binary name align (`agentic-tuneup-pro`).
  - Secondary helper binary `atpd-helper` is packaged alongside the main binary.

---

## 6. Runtime Dependencies & Extra Files

* **Binaries:**
  * `/usr/bin/agentic-tuneup-pro` (GUI)
  * `/usr/bin/atpd-helper` (Privileged root D-Bus helper)
* **Polkit Policy:** `/usr/share/polkit-1/actions/in.zvirox.agentic_tuneup.policy`
* **D-Bus Config:** `/usr/share/dbus-1/system.d/in.zvirox.AgenticTuneupHelper.conf`
* **Systemd Unit:** `/usr/lib/systemd/system/atpd-helper.service`
* **Desktop File:** `/usr/share/applications/agentic-tuneup-pro.desktop`
* **Runtime Dependencies:**
  * Debian/Ubuntu: `libwebkit2gtk-4.1-0`, `libgtk-3-0`, `libayatana-appindicator3-1`, `polkit-1`, `dbus`
  * Fedora/RPM: `webkit2gtk4.1`, `gtk3`, `libappindicator-gtk3`, `polkit`, `dbus`
  * Arch Linux: `webkit2gtk-4.1`, `gtk3`, `libayatana-appindicator`, `polkit`, `dbus`

---

## 7. Secrets Used

* None configured yet in repository CI.
* Target shared release workflow will use `GITHUB_TOKEN` and optional `SIGNING_KEY`.

---

## 8. Packaging Formats & Migration Action Table

| Format | Present | Job / File Location | Action |
|---|---|---|---|
| **Debian (.deb)** | Yes | Offline build (`packaging/deb/`) | **Migrate** to central `nfpm` workflow |
| **RPM (.rpm)** | Yes | Offline build (`packaging/rpm/`) | **Migrate** to central `nfpm` workflow |
| **Arch (.pkg.tar.zst)** | Yes | Offline manual build | **Migrate** to central `nfpm` workflow |
| **AppImage** | Yes | `packaging/appimage/AppRun` | **Delete** `packaging/appimage/` directory |
| **Flatpak** | Yes | `packaging/flatpak/` | **Delete** `packaging/flatpak/` directory |
| **Tarball (.tar.gz)** | Yes | Manual release asset | **Delete** from future release outputs |
| **AUR Publishing** | Yes | `packaging/aur/` directory | **Deprecate** & point to GitHub release |
| **Checksums** | Yes | `SHA256SUMS` in release | **Keep** & unify via nfpm pipeline |
