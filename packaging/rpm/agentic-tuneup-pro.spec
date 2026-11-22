Name:           agentic-tuneup-pro
Version:        0.0.2
Release:        alpha.1%{?dist}
Summary:        Sovereign AI-orchestrated Linux cleaner and performance suite
License:        Apache-2.0
URL:            https://github.com/zvirox/agentic-tuneup-pro
ExclusiveArch:  x86_64 aarch64

%{!?_unitdir: %define _unitdir /usr/lib/systemd/system}
%{!?systemd_post: %define systemd_post() /usr/bin/systemctl daemon-reload &>/dev/null || :}
%{!?systemd_preun: %define systemd_preun() /usr/bin/systemctl stop atpd-helper.service &>/dev/null || :}
%{!?systemd_postun_with_restart: %define systemd_postun_with_restart() /usr/bin/systemctl daemon-reload &>/dev/null || :}

Requires:       webkit2gtk4.1
Requires:       gtk3
Requires:       libappindicator-gtk3
Requires:       polkit
Requires:       dbus
Requires:       systemd

%description
Agentic Tuneup Pro is a sovereign, glass-UI system cleaner, package manager,
and performance tune-up suite for Linux, orchestrated by an AI agent and
integrated into the Starship Control ecosystem via Model Context Protocol (MCP).
Featuring zero unquarantined deletions, atomic multi-file rollback, and
Polkit-gated system privileges.

%prep
# No prep required for pre-built binaries

%build
# Binaries pre-compiled via cargo workspace release

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}%{_bindir}
mkdir -p %{buildroot}%{_libexecdir}
mkdir -p %{buildroot}%{_datadir}/applications
mkdir -p %{buildroot}%{_datadir}/metainfo
mkdir -p %{buildroot}%{_datadir}/polkit-1/actions
mkdir -p %{buildroot}%{_datadir}/dbus-1/system.d
mkdir -p %{buildroot}%{_unitdir}
mkdir -p %{buildroot}%{_datadir}/icons/hicolor/scalable/apps
mkdir -p %{buildroot}%{_datadir}/icons/hicolor/128x128/apps
mkdir -p %{buildroot}%{_datadir}/icons/hicolor/32x32/apps

# Install binaries
install -m 0755 %{_sourcedir}/agentic-tuneup-pro %{buildroot}%{_bindir}/agentic-tuneup-pro
install -m 0755 %{_sourcedir}/atpd-helper %{buildroot}%{_libexecdir}/atpd-helper

# Install desktop & metadata
install -m 0644 %{_sourcedir}/agentic-tuneup-pro.desktop %{buildroot}%{_datadir}/applications/
install -m 0644 %{_sourcedir}/in.zvirox.agentictuneuppro.metainfo.xml %{buildroot}%{_datadir}/metainfo/

# Install polkit & dbus configs
install -m 0644 %{_sourcedir}/in.zvirox.agentic_tuneup.policy %{buildroot}%{_datadir}/polkit-1/actions/
install -m 0644 %{_sourcedir}/in.zvirox.AgenticTuneupHelper.conf %{buildroot}%{_datadir}/dbus-1/system.d/
install -m 0644 %{_sourcedir}/atpd-helper.service %{buildroot}%{_unitdir}/

# Install icons
install -m 0644 %{_sourcedir}/in.zvirox.agentictuneuppro.svg %{buildroot}%{_datadir}/icons/hicolor/scalable/apps/in.zvirox.agentictuneuppro.svg
install -m 0644 %{_sourcedir}/128x128.png %{buildroot}%{_datadir}/icons/hicolor/128x128/apps/in.zvirox.agentictuneuppro.png
install -m 0644 %{_sourcedir}/32x32.png %{buildroot}%{_datadir}/icons/hicolor/32x32/apps/in.zvirox.agentictuneuppro.png

%post
%systemd_post atpd-helper.service
/bin/touch --no-create %{_datadir}/icons/hicolor &>/dev/null || :
/usr/bin/update-desktop-database &>/dev/null || :

%preun
%systemd_preun atpd-helper.service

%postun
%systemd_postun_with_restart atpd-helper.service
if [ $1 -eq 0 ] ; then
    /bin/touch --no-create %{_datadir}/icons/hicolor &>/dev/null
    /usr/bin/gtk-update-icon-cache %{_datadir}/icons/hicolor &>/dev/null || :
    /usr/bin/update-desktop-database &>/dev/null || :
fi

%posttrans
/usr/bin/gtk-update-icon-cache %{_datadir}/icons/hicolor &>/dev/null || :

%files
%{_bindir}/agentic-tuneup-pro
%{_libexecdir}/atpd-helper
%{_datadir}/applications/agentic-tuneup-pro.desktop
%{_datadir}/metainfo/in.zvirox.agentictuneuppro.metainfo.xml
%{_datadir}/polkit-1/actions/in.zvirox.agentic_tuneup.policy
%{_datadir}/dbus-1/system.d/in.zvirox.AgenticTuneupHelper.conf
%{_unitdir}/atpd-helper.service
%{_datadir}/icons/hicolor/scalable/apps/in.zvirox.agentictuneuppro.svg
%{_datadir}/icons/hicolor/128x128/apps/in.zvirox.agentictuneuppro.png
%{_datadir}/icons/hicolor/32x32/apps/in.zvirox.agentictuneuppro.png

%changelog
* Sun Nov 22 2026 Zvirox <cyber@zvirox.in> - 0.0.1-alpha.1
- First alpha release of Agentic Tuneup Pro.
