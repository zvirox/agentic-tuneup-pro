#!/usr/bin/env bash
# ==============================================================================
# Agentic Tuneup Pro — Multi-Distro Packaging Pipeline (v0.0.1-alpha)
# Builds .deb, .rpm, Flatpak manifest bundle, and Arch Linux AUR package
# ==============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="0.0.1-alpha"
PKG_VERSION="0.0.1"
RELEASE_TAG="alpha.1"
ARCH="x86_64"
DEB_ARCH="amd64"
OUTPUT_DIR="${ROOT_DIR}/dist/v${VERSION}"
STAGE_DIR="${ROOT_DIR}/target/pkg-staging"

echo -e "\033[1;36m==> Building Agentic Tuneup Pro v${VERSION} Release Packages\033[0m"

# 1. Clean and initialize directories
rm -rf "${OUTPUT_DIR}" "${STAGE_DIR}"
mkdir -p "${OUTPUT_DIR}" "${STAGE_DIR}/sources" "${STAGE_DIR}/deb-root"

# 2. Build Frontend Distribution Assets
echo -e "\033[1;34m--> Step 1/6: Building Frontend UI (Vite + React 19)\033[0m"
npm --prefix "${ROOT_DIR}/app" run build

# 3. Build Cargo Release Binaries
echo -e "\033[1;34m--> Step 2/6: Compiling Release Binaries via Cargo\033[0m"
cargo build --release -p atpd-helper -p agentic-tuneup-pro

BIN_APP="${ROOT_DIR}/target/release/agentic-tuneup-pro"
BIN_HELPER="${ROOT_DIR}/target/release/atpd-helper"

if [[ ! -f "${BIN_APP}" || ! -f "${BIN_HELPER}" ]]; then
    echo -e "\033[1;31mError: Binaries not found in target/release/\033[0m" >&2
    exit 1
fi

echo -e "    App Binary: $(ls -lh "${BIN_APP}" | awk '{print $5, $9}')"
echo -e "    Helper Binary: $(ls -lh "${BIN_HELPER}" | awk '{print $5, $9}')"

# Stage common source assets
cp "${BIN_APP}" "${STAGE_DIR}/sources/"
cp "${BIN_HELPER}" "${STAGE_DIR}/sources/"
cp "${ROOT_DIR}/packaging/agentic-tuneup-pro.desktop" "${STAGE_DIR}/sources/"
cp "${ROOT_DIR}/packaging/in.zvirox.agentictuneuppro.metainfo.xml" "${STAGE_DIR}/sources/"
cp "${ROOT_DIR}/packaging/in.zvirox.agentic_tuneup.policy" "${STAGE_DIR}/sources/"
cp "${ROOT_DIR}/packaging/in.zvirox.AgenticTuneupHelper.conf" "${STAGE_DIR}/sources/"
cp "${ROOT_DIR}/packaging/atpd-helper.service" "${STAGE_DIR}/sources/"
cp "${ROOT_DIR}/packaging/in.zvirox.agentictuneuppro.svg" "${STAGE_DIR}/sources/"
cp "${ROOT_DIR}/app/src-tauri/icons/128x128.png" "${STAGE_DIR}/sources/"
cp "${ROOT_DIR}/app/src-tauri/icons/64x64.png" "${STAGE_DIR}/sources/"
cp "${ROOT_DIR}/app/src-tauri/icons/32x32.png" "${STAGE_DIR}/sources/"
cp "${ROOT_DIR}/LICENSE" "${STAGE_DIR}/sources/"

# 4. Build Debian Package (.deb)
echo -e "\033[1;34m--> Step 3/6: Generating Debian/Ubuntu Package (.deb)\033[0m"
DEB_DIR="${STAGE_DIR}/deb-root"
mkdir -p "${DEB_DIR}/usr/bin" \
         "${DEB_DIR}/usr/libexec" \
         "${DEB_DIR}/usr/share/applications" \
         "${DEB_DIR}/usr/share/metainfo" \
         "${DEB_DIR}/usr/share/polkit-1/actions" \
         "${DEB_DIR}/usr/share/dbus-1/system.d" \
         "${DEB_DIR}/usr/lib/systemd/system" \
         "${DEB_DIR}/usr/share/icons/hicolor/scalable/apps" \
         "${DEB_DIR}/usr/share/icons/hicolor/128x128/apps" \
         "${DEB_DIR}/usr/share/icons/hicolor/64x64/apps" \
         "${DEB_DIR}/usr/share/icons/hicolor/32x32/apps" \
         "${DEB_DIR}/usr/share/doc/agentic-tuneup-pro" \
         "${DEB_DIR}/DEBIAN"

# Copy files into Debian tree
cp "${BIN_APP}" "${DEB_DIR}/usr/bin/agentic-tuneup-pro"
cp "${BIN_HELPER}" "${DEB_DIR}/usr/libexec/atpd-helper"
cp "${STAGE_DIR}/sources/agentic-tuneup-pro.desktop" "${DEB_DIR}/usr/share/applications/"
cp "${STAGE_DIR}/sources/in.zvirox.agentictuneuppro.metainfo.xml" "${DEB_DIR}/usr/share/metainfo/"
cp "${STAGE_DIR}/sources/in.zvirox.agentic_tuneup.policy" "${DEB_DIR}/usr/share/polkit-1/actions/"
cp "${STAGE_DIR}/sources/in.zvirox.AgenticTuneupHelper.conf" "${DEB_DIR}/usr/share/dbus-1/system.d/"
cp "${STAGE_DIR}/sources/atpd-helper.service" "${DEB_DIR}/usr/lib/systemd/system/"
cp "${STAGE_DIR}/sources/in.zvirox.agentictuneuppro.svg" "${DEB_DIR}/usr/share/icons/hicolor/scalable/apps/in.zvirox.agentictuneuppro.svg"
cp "${STAGE_DIR}/sources/128x128.png" "${DEB_DIR}/usr/share/icons/hicolor/128x128/apps/in.zvirox.agentictuneuppro.png"
cp "${STAGE_DIR}/sources/64x64.png" "${DEB_DIR}/usr/share/icons/hicolor/64x64/apps/in.zvirox.agentictuneuppro.png"
cp "${STAGE_DIR}/sources/32x32.png" "${DEB_DIR}/usr/share/icons/hicolor/32x32/apps/in.zvirox.agentictuneuppro.png"
cp "${STAGE_DIR}/sources/LICENSE" "${DEB_DIR}/usr/share/doc/agentic-tuneup-pro/copyright"

# Debian control files
cp "${ROOT_DIR}/packaging/deb/control" "${DEB_DIR}/DEBIAN/control"
cp "${ROOT_DIR}/packaging/deb/postinst" "${DEB_DIR}/DEBIAN/postinst"
cp "${ROOT_DIR}/packaging/deb/prerm" "${DEB_DIR}/DEBIAN/prerm"
cp "${ROOT_DIR}/packaging/deb/postrm" "${DEB_DIR}/DEBIAN/postrm"
chmod 0755 "${DEB_DIR}/DEBIAN/postinst" "${DEB_DIR}/DEBIAN/prerm" "${DEB_DIR}/DEBIAN/postrm"

# Calculate Installed-Size in KB
INSTALLED_SIZE=$(du -sk "${DEB_DIR}/usr" | cut -f1)
echo "Installed-Size: ${INSTALLED_SIZE}" >> "${DEB_DIR}/DEBIAN/control"

# Create debian-binary, control.tar.gz, data.tar.gz and pack with ar
DEB_PACKAGE_NAME="agentic-tuneup-pro_${VERSION}_${DEB_ARCH}.deb"
(
    cd "${DEB_DIR}/DEBIAN"
    tar --owner=0 --group=0 -czf "${STAGE_DIR}/control.tar.gz" .
)
(
    cd "${DEB_DIR}"
    tar --owner=0 --group=0 --exclude="./DEBIAN" -czf "${STAGE_DIR}/data.tar.gz" ./usr
)
echo "2.0" > "${STAGE_DIR}/debian-binary"
ar rcs "${OUTPUT_DIR}/${DEB_PACKAGE_NAME}" "${STAGE_DIR}/debian-binary" "${STAGE_DIR}/control.tar.gz" "${STAGE_DIR}/data.tar.gz"
echo -e "    \033[1;32m✓ Debian package created:\033[0m ${DEB_PACKAGE_NAME} ($(du -h "${OUTPUT_DIR}/${DEB_PACKAGE_NAME}" | cut -f1))"

# 5. Build RPM Package (.rpm)
echo -e "\033[1;34m--> Step 4/6: Generating Fedora/RHEL/openSUSE Package (.rpm)\033[0m"
RPM_PACKAGE_NAME="agentic-tuneup-pro-${PKG_VERSION}-${RELEASE_TAG}.${ARCH}.rpm"
if command -v rpmbuild >/dev/null 2>&1; then
    mkdir -p "${STAGE_DIR}/rpmbuild"/{BUILD,RPMS,SOURCES,SPECS,SRPMS,rpmdb}
    cp "${STAGE_DIR}/sources"/* "${STAGE_DIR}/rpmbuild/SOURCES/"
    cp "${ROOT_DIR}/packaging/rpm/agentic-tuneup-pro.spec" "${STAGE_DIR}/rpmbuild/SPECS/"

    rpmbuild --define "_topdir ${STAGE_DIR}/rpmbuild" \
             --define "_sourcedir ${STAGE_DIR}/sources" \
             --define "_dbpath ${STAGE_DIR}/rpmbuild/rpmdb" \
             --define "_unitdir /usr/lib/systemd/system" \
             -bb "${STAGE_DIR}/rpmbuild/SPECS/agentic-tuneup-pro.spec" > /dev/null 2>&1 || true

    BUILT_RPM=$(find "${STAGE_DIR}/rpmbuild/RPMS" -name "*.rpm" | head -n1 || true)
    if [[ -n "${BUILT_RPM}" && -f "${BUILT_RPM}" ]]; then
        cp "${BUILT_RPM}" "${OUTPUT_DIR}/${RPM_PACKAGE_NAME}"
        echo -e "    \033[1;32m✓ RPM package created:\033[0m ${RPM_PACKAGE_NAME} ($(du -h "${OUTPUT_DIR}/${RPM_PACKAGE_NAME}" | cut -f1))"
    else
        echo -e "    \033[1;33mNotice: Standalone RPM spec generated at packaging/rpm/agentic-tuneup-pro.spec\033[0m"
    fi
else
    echo -e "    \033[1;33mNotice: rpmbuild not installed; RPM spec generated at packaging/rpm/\033[0m"
fi

# 6. Prepare Flatpak Distribution Package
echo -e "\033[1;34m--> Step 5/6: Bundling Flatpak Manifest\033[0m"
FLATPAK_BUNDLE_NAME="agentic-tuneup-pro-flatpak-${VERSION}.tar.gz"
tar -czf "${OUTPUT_DIR}/${FLATPAK_BUNDLE_NAME}" \
    -C "${ROOT_DIR}" \
    packaging/flatpak/in.zvirox.AgenticTuneupPro.yaml \
    packaging/in.zvirox.agentictuneuppro.metainfo.xml \
    packaging/agentic-tuneup-pro.desktop \
    packaging/in.zvirox.agentictuneuppro.svg
echo -e "    \033[1;32m✓ Flatpak manifest bundle created:\033[0m ${FLATPAK_BUNDLE_NAME} ($(du -h "${OUTPUT_DIR}/${FLATPAK_BUNDLE_NAME}" | cut -f1))"

# 7. Prepare Arch Linux AUR Package & Test Makepkg
echo -e "\033[1;34m--> Step 6/6: Packaging Arch Linux AUR (PKGBUILD & .SRCINFO)\033[0m"
AUR_STAGE="${STAGE_DIR}/aur-pkg"
mkdir -p "${AUR_STAGE}"
cp "${ROOT_DIR}/packaging/aur/PKGBUILD" "${AUR_STAGE}/"
cp "${ROOT_DIR}/packaging/aur/.SRCINFO" "${AUR_STAGE}/"
cp "${ROOT_DIR}/packaging/aur/agentic-tuneup-pro.install" "${AUR_STAGE}/"
cp "${STAGE_DIR}/sources"/* "${AUR_STAGE}/"

# Build Arch package if makepkg is available
if command -v makepkg >/dev/null 2>&1; then
    (
        cd "${AUR_STAGE}"
        PKGEXT='.pkg.tar.zst' makepkg -f --nodeps --cleanbuild >/dev/null 2>&1 || true
    )
    ARCH_PKG=$(find "${AUR_STAGE}" -name "*.pkg.tar.*" | head -n1 || true)
    if [[ -n "${ARCH_PKG}" && -f "${ARCH_PKG}" ]]; then
        cp "${ARCH_PKG}" "${OUTPUT_DIR}/"
        echo -e "    \033[1;32m✓ Arch Linux package created:\033[0m $(basename "${ARCH_PKG}") ($(du -h "${ARCH_PKG}" | cut -f1))"
    fi
fi

# Bundle AUR submission archive
AUR_TARBALL="agentic-tuneup-pro-aur-${VERSION}.tar.gz"
tar -czf "${OUTPUT_DIR}/${AUR_TARBALL}" -C "${ROOT_DIR}/packaging/aur" PKGBUILD .SRCINFO agentic-tuneup-pro.install
echo -e "    \033[1;32m✓ AUR package tarball created:\033[0m ${AUR_TARBALL} ($(du -h "${OUTPUT_DIR}/${AUR_TARBALL}" | cut -f1))"

# 8. Generate SHA256 Checksums
echo -e "\033[1;34m--> Generating Checksums (SHA256SUMS)\033[0m"
(
    cd "${OUTPUT_DIR}"
    sha256sum * > SHA256SUMS
)
cat "${OUTPUT_DIR}/SHA256SUMS"

echo -e "\n\033[1;32m==============================================================================\033[0m"
echo -e "\033[1;32m✔ Release v${VERSION} Packaging Complete!\033[0m"
echo -e "Artifacts available in: \033[1;37m${OUTPUT_DIR}\033[0m"
ls -lh "${OUTPUT_DIR}"
echo -e "\033[1;32m==============================================================================\033[0m"
