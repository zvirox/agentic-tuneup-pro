#!/bin/sh
set -e

if [ -d /run/systemd/system ]; then
    systemctl stop atpd-helper.service 2>/dev/null || true
    systemctl disable atpd-helper.service 2>/dev/null || true
fi

exit 0
