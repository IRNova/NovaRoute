#!/usr/bin/env bash
#
# NovaRoute uninstaller
# Removes the systemd service, source tree, and data directory.

set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/novaroute}"
DATA_DIR="${DATA_DIR:-/var/lib/novaroute}"
SERVICE_NAME="${SERVICE_NAME:-novaroute}"
SERVICE_USER="${SERVICE_USER:-novaroute}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "This uninstaller must run as root." >&2
  exit 1
fi

echo "This will permanently remove:"
echo "  - systemd service: ${SERVICE_NAME}"
echo "  - installation:    ${INSTALL_DIR}"
echo "  - data/state:      ${DATA_DIR}"
read -r -p "Are you sure? [y/N] " confirm < /dev/tty

if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Uninstall cancelled."
  exit 0
fi

echo "Stopping service..."
systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
systemctl disable "${SERVICE_NAME}" 2>/dev/null || true
rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
systemctl daemon-reload 2>/dev/null || true

echo "Removing installation..."
rm -rf "${INSTALL_DIR}"

echo "Removing data..."
rm -rf "${DATA_DIR}"

if id -u "${SERVICE_USER}" >/dev/null 2>&1; then
  userdel "${SERVICE_USER}" 2>/dev/null || true
fi

echo "NovaRoute has been uninstalled."
