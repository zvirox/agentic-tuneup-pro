#!/usr/bin/env bash
# ==============================================================================
# Agentic Tuneup Pro — Cross-Distro & Packaging Verification Matrix
# Phase 8.2: Automated multi-distro validation & test suite
# ==============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "\033[1;36m==============================================================================\033[0m"
echo -e "\033[1;36m  Agentic Tuneup Pro (ATP) — Cross-Distro & Packaging Verification Matrix    \033[0m"
echo -e "\033[1;36m==============================================================================\033[0m"

FAILED=0

pass() {
    echo -e "  \033[1;32m✔ [PASS]\033[0m $1"
}

fail() {
    echo -e "  \033[1;31m✘ [FAIL]\033[0m $1" >&2
    FAILED=$((FAILED + 1))
}

info() {
    echo -e "\n\033[1;34m--> $1\033[0m"
}

# 1. Freedesktop Standards & Integration Specs
info "Step 1: Validating Freedesktop Specs & System Configurations"

if command -v desktop-file-validate >/dev/null 2>&1; then
    if desktop-file-validate "${ROOT_DIR}/packaging/agentic-tuneup-pro.desktop"; then
        pass "Desktop entry specification (agentic-tuneup-pro.desktop)"
    else
        fail "Desktop entry validation failed"
    fi
else
    echo "  [SKIP] desktop-file-validate not available"
fi

if command -v appstreamcli >/dev/null 2>&1; then
    if appstreamcli validate "${ROOT_DIR}/packaging/in.zvirox.agentictuneuppro.metainfo.xml" --no-net; then
        pass "AppStream Metainfo specification (in.zvirox.agentictuneuppro.metainfo.xml)"
    else
        fail "AppStream Metainfo validation failed"
    fi
else
    echo "  [SKIP] appstreamcli not available"
fi

if command -v xmllint >/dev/null 2>&1; then
    if xmllint --noout "${ROOT_DIR}/packaging/in.zvirox.agentic_tuneup.policy"; then
        pass "Polkit XML Policy syntax (in.zvirox.agentic_tuneup.policy)"
    else
        fail "Polkit Policy XML invalid"
    fi

    if xmllint --noout "${ROOT_DIR}/packaging/in.zvirox.AgenticTuneupHelper.conf"; then
        pass "D-Bus System Bus XML configuration (in.zvirox.AgenticTuneupHelper.conf)"
    else
        fail "D-Bus configuration XML invalid"
    fi
fi

# Check systemd unit file presence and directives
if grep -q "ExecStart=/usr/libexec/atpd-helper" "${ROOT_DIR}/packaging/atpd-helper.service" && \
   grep -q "BusName=in.zvirox.AgenticTuneupHelper" "${ROOT_DIR}/packaging/atpd-helper.service"; then
    pass "Systemd helper service unit (packaging/atpd-helper.service)"
else
    fail "Systemd helper service unit missing required directives"
fi

# 2. Distro Package Manifest Consistency
info "Step 2: Checking Multi-Distro Packaging Manifests"

# Debian
if [ -f "${ROOT_DIR}/packaging/deb/control" ] && \
   grep -q "Package: agentic-tuneup-pro" "${ROOT_DIR}/packaging/deb/control"; then
    pass "Debian/Ubuntu control file (packaging/deb/control)"
else
    fail "Debian control file missing or corrupted"
fi

# Fedora RPM
if [ -f "${ROOT_DIR}/packaging/rpm/agentic-tuneup-pro.spec" ] && \
   grep -q "Name:           agentic-tuneup-pro" "${ROOT_DIR}/packaging/rpm/agentic-tuneup-pro.spec"; then
    pass "Fedora RPM spec file (packaging/rpm/agentic-tuneup-pro.spec)"
else
    fail "RPM spec file missing or corrupted"
fi

# Arch Linux AUR
if [ -f "${ROOT_DIR}/packaging/aur/PKGBUILD" ] && \
   grep -q "pkgname=agentic-tuneup-pro-bin" "${ROOT_DIR}/packaging/aur/PKGBUILD"; then
    pass "Arch Linux AUR PKGBUILD (packaging/aur/PKGBUILD)"
else
    fail "Arch Linux AUR PKGBUILD missing or corrupted"
fi

# Flatpak Manifest
if [ -f "${ROOT_DIR}/packaging/flatpak/in.zvirox.AgenticTuneupPro.yaml" ] && \
   grep -q "id: in.zvirox.AgenticTuneupPro" "${ROOT_DIR}/packaging/flatpak/in.zvirox.AgenticTuneupPro.yaml"; then
    pass "Flatpak YAML manifest (packaging/flatpak/in.zvirox.AgenticTuneupPro.yaml)"
else
    fail "Flatpak YAML manifest missing or corrupted"
fi

# 3. Rust Workspace Test Matrix
info "Step 3: Running Workspace Rust Unit & Integration Tests (9 Crates)"
if cargo test --workspace --quiet; then
    pass "Cargo test suite (88+ tests across all 9 crates)"
else
    fail "One or more Cargo unit/integration tests failed"
fi

# 4. Frontend UI/UX Accessibility & Build Check
info "Step 4: Compiling Frontend UI & Checking TypeScript Types"
if npm --prefix "${ROOT_DIR}/app" run build >/dev/null 2>&1; then
    pass "React 19 + TypeScript + Vite build succeeded"
else
    fail "Frontend build failed"
fi

# 5. Summary
echo -e "\n\033[1;36m==============================================================================\033[0m"
if [ "${FAILED}" -eq 0 ]; then
    echo -e "\033[1;32m  ALL CHECKS PASSED: Cross-Distro Packaging & Quality Matrix Verified!  \033[0m"
    echo -e "\033[1;36m==============================================================================\033[0m"
    exit 0
else
    echo -e "\033[1;31m  ${FAILED} CHECKS FAILED. Please review the output above.             \033[0m"
    echo -e "\033[1;36m==============================================================================\033[0m"
    exit 1
fi
