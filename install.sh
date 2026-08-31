#!/usr/bin/env bash
#
# NovaRoute one-line installer / updater
# Repository: https://github.com/IRNova/NovaRoute
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/IRNova/NovaRoute/main/install.sh | sudo bash
#
# Runs everything as root. No separate user.

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
INSTALL_DIR="${INSTALL_DIR:-/opt/novaroute}"
DATA_DIR="${DATA_DIR:-/var/lib/novaroute}"
PORT="${PORT:-20126}"
SERVICE_NAME="${SERVICE_NAME:-novaroute}"
NODE_VERSION_MIN="${NODE_VERSION:-20}"
REPO_URL="${REPO_URL:-https://github.com/IRNova/NovaRoute.git}"
BRANCH="${BRANCH:-main}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log() { printf '\e[36m[NovaRoute]\e[0m %s\n' "$*"; }
warn() { printf '\e[33m[NovaRoute]\e[0m %s\n' "$*" >&2; }
error() { printf '\e[31m[NovaRoute]\e[0m %s\n' "$*" >&2; exit 1; }

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    error "This installer must run as root. Try: curl -fsSL ... | sudo bash"
  fi
}

command_exists() { command -v "$1" >/dev/null 2>&1; }

node_version_ok() {
  if ! command_exists node; then return 1; fi
  local ver major
  ver="$(node -v | sed 's/^v//')"
  major="${ver%%.*}"
  [[ "$major" -ge "$NODE_VERSION_MIN" ]]
}

install_nodejs() {
  log "Node.js ${NODE_VERSION_MIN}+ required. Installing..."
  if command_exists apt-get; then
    apt-get update -qq
    apt-get install -y -qq curl ca-certificates gnupg

    # Remove any previous broken/incomplete Node.js installs (common cause of missing npm)
    apt-get remove -y -qq nodejs npm 2>/dev/null || true
    apt-get autoremove -y -qq 2>/dev/null || true

    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_VERSION_MIN}.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list

    apt-get update -qq
    apt-get install -y -qq nodejs

    # Fallback: on some Ubuntu versions NodeSource package may still leave npm missing
    if ! command_exists npm; then
      warn "npm not found after NodeSource install. Installing npm as fallback..."
      apt-get install -y -qq npm
    fi

  elif command_exists dnf; then
    dnf module reset -y nodejs
    dnf module install -y "nodejs:${NODE_VERSION_MIN}"
  elif command_exists yum; then
    curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION_MIN}.x | bash -
    yum install -y nodejs
  else
    error "Unsupported package manager. Install Node.js ${NODE_VERSION_MIN}+ manually."
  fi

  # Final hard check
  if ! command_exists node || ! command_exists npm; then
    error "Failed to install a working Node.js + npm. Please install them manually and re-run."
  fi
}

install_build_tools() {
  if command_exists apt-get; then
    apt-get install -y -qq build-essential python3 pkg-config 2>/dev/null || true
  elif command_exists dnf; then
    dnf groupinstall -y "Development Tools" 2>/dev/null || true
  elif command_exists yum; then
    yum groupinstall -y "Development Tools" 2>/dev/null || true
  fi
}

secure_random() {
  local len="${1:-48}"
  if command_exists openssl; then
    openssl rand -base64 "$len" | tr -dc 'A-Za-z0-9' | head -c "$len"
  else
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$len"
  fi
}

# ---------------------------------------------------------------------------
# Domain + automatic HTTPS (Caddy)
# ---------------------------------------------------------------------------
CADDY_BIN="/usr/local/bin/caddy"

upsert_env() {
  local key="$1" value="$2" file="${INSTALL_DIR}/.env"
  mkdir -p "$(dirname "${file}")"
  touch "${file}"
  if grep -q "^${key}=" "${file}"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${file}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${file}"
  fi
}

current_domain() {
  local value=""
  if [[ -f "${INSTALL_DIR}/.env" ]]; then
    value="$(sed -n 's/^PUBLIC_DOMAIN=//p' "${INSTALL_DIR}/.env" | head -n1 || true)"
  fi
  printf '%s' "${value}"
}

prompt_domain() {
  # Non-interactive overrides: NO_DOMAIN=1 skips, DOMAIN=x.com pre-sets.
  if [[ "${NO_DOMAIN:-0}" == "1" ]]; then DOMAIN=""; return; fi
  if [[ -n "${DOMAIN:-}" ]]; then return; fi

  local existing answer input
  existing="$(current_domain)"
  echo
  if [[ "${IS_UPDATE}" -eq 1 ]]; then
    if [[ -n "${existing}" ]]; then
      log "Current domain: ${existing}"
      read -r -p "Keep this domain? [Y/n]: " answer < /dev/tty || answer=""
      case "${answer}" in
        n|N) ;;
        *) DOMAIN="${existing}"; return ;;
      esac
      read -r -p "New domain (empty = remove domain and disable HTTPS): " input < /dev/tty || input=""
    else
      log "Optional: a domain enables automatic HTTPS (required for Telegram webhooks)."
      read -r -p "Domain name (empty = skip): " input < /dev/tty || input=""
    fi
  else
    log "Optional: a domain enables automatic HTTPS (required for Telegram webhooks)."
    read -r -p "Domain name (empty = skip): " input < /dev/tty || input=""
  fi

  DOMAIN="$(printf '%s' "${input}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
}

validate_domain() {
  [[ -z "${DOMAIN}" ]] && return 0
  if ! [[ "${DOMAIN}" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; then
    error "Invalid domain: '${DOMAIN}' (example: panel.example.com)"
  fi
}

check_dns() {
  [[ -z "${DOMAIN}" ]] && return 0
  local server_ip resolved
  server_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  resolved="$(getent hosts "${DOMAIN}" 2>/dev/null | awk '{print $1}' | head -n1 || true)"
  if [[ -z "${resolved}" ]]; then
    warn "DNS for ${DOMAIN} does not resolve yet - SSL will fail until it points here."
  elif [[ -n "${server_ip}" && "${resolved}" != "${server_ip}" ]]; then
    warn "DNS for ${DOMAIN} -> ${resolved}, but this server looks like ${server_ip}."
    warn "SSL will fail until DNS points to this server."
  fi
}

open_firewall() {
  local extra_port="${1:-443}"
  if command_exists ufw; then
    ufw allow "${PORT}"/tcp >/dev/null 2>&1 || true
    ufw allow "${extra_port}"/tcp >/dev/null 2>&1 || true
  elif command_exists firewall-cmd; then
    firewall-cmd --permanent --add-port="${PORT}"/tcp >/dev/null 2>&1 || true
    firewall-cmd --permanent --add-port="${extra_port}"/tcp >/dev/null 2>&1 || true
    firewall-cmd --reload >/dev/null 2>&1 || true
  fi
}

https_port_busy() {
  ss -tln 2>/dev/null | grep -Eq '[:.]443[[:space:]]'
}

prompt_https_port() {
  [[ -z "${DOMAIN}" ]] && return 0
  # Non-interactive override: HTTPS_PORT=8443 pre-sets the choice.
  if [[ -n "${HTTPS_PORT_FORCE:-}" ]]; then HTTPS_PORT="${HTTPS_PORT_FORCE}"; return; fi

  local saved input
  saved=""
  if [[ -f "${INSTALL_DIR}/.env" ]]; then
    saved="$(sed -n 's/^PUBLIC_HTTPS_PORT=//p' "${INSTALL_DIR}/.env" | head -n1 || true)"
  fi

  if ! https_port_busy; then
    HTTPS_PORT=443
    return
  fi

  warn "TCP port 443 is already in use by another program (e.g. xray/nginx)."
  echo
  read -r -p "HTTPS port to use instead [${saved:-8443}]: " input < /dev/tty || input=""
  input="$(printf '%s' "${input}" | tr -d '[:space:]')"
  if [[ -z "${input}" ]]; then
    input="${saved:-8443}"
  fi
  if ! [[ "${input}" =~ ^[0-9]+$ ]] || [[ "${input}" -lt 1 ]] || [[ "${input}" -gt 65535 ]]; then
    error "Invalid HTTPS port: ${input}"
  fi
  HTTPS_PORT="${input}"
  log "HTTPS will be served on port ${HTTPS_PORT}."
}

install_caddy() {
  if [[ -x "${CADDY_BIN}" ]] && systemdctl_unit_present; then return; fi
  log "Installing Caddy (automatic HTTPS reverse proxy)..."
  local arch
  arch="$(uname -m)"
  case "${arch}" in
    x86_64) arch="amd64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) error "Unsupported architecture for Caddy: ${arch}" ;;
  esac
  curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=${arch}" -o "${CADDY_BIN}"
  chmod +x "${CADDY_BIN}"

  id caddy >/dev/null 2>&1 || useradd --system --home /var/lib/caddy --create-home --shell /usr/sbin/nologin caddy
  mkdir -p /etc/caddy

  cat > /etc/systemd/system/caddy.service <<EOF
[Unit]
Description=Caddy web server (NovaRoute HTTPS)
After=network-online.target
Wants=network-online.target

[Service]
User=caddy
Group=caddy
ExecStart=${CADDY_BIN} run --environ --config /etc/caddy/Caddyfile
ExecReload=${CADDY_BIN} reload --config /etc/caddy/Caddyfile --force
TimeoutStopSec=5s
LimitNOFILE=1048576
PrivateTmp=true
ProtectSystem=full
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable caddy >/dev/null 2>&1 || true
}

systemdctl_unit_present() {
  [[ -f /etc/systemd/system/caddy.service ]]
}

configure_caddy() {
  [[ -z "${DOMAIN}" ]] && return 0
  install_caddy
  check_dns

  log "Configuring Caddy for ${DOMAIN} -> 127.0.0.1:${PORT} ..."
  local site
  if [[ "${HTTPS_PORT}" == "443" ]]; then
    site="${DOMAIN}"
  else
    # Non-standard HTTPS port (443 busy). Telegram webhooks accept ports
    # 443, 80, 88 and 8443 — 8443 keeps the bot's webhook usable too.
    site="https://${DOMAIN}:${HTTPS_PORT}"
  fi

  cat > /etc/caddy/Caddyfile <<EOF
# Managed by NovaRoute installer - manual edits will be overwritten.
${site} {
	reverse_proxy 127.0.0.1:${PORT}
}
EOF
  chown caddy:caddy /etc/caddy/Caddyfile 2>/dev/null || true
  open_firewall "${HTTPS_PORT}"
  systemctl restart caddy
  sleep 3
  if systemctl is-active --quiet caddy; then
    if [[ "${HTTPS_PORT}" == "443" ]]; then
      log "HTTPS certificate is being issued (Let's Encrypt)."
      log "URL: https://${DOMAIN}"
    else
      log "HTTPS certificate is being issued via port 80 (Let's Encrypt)."
      log "URL: https://${DOMAIN}:${HTTPS_PORT}"
    fi
  else
    warn "Caddy failed to start. Check: journalctl -u caddy -n 30"
  fi
}

remove_caddy_domain() {
  if [[ -f /etc/caddy/Caddyfile ]]; then
    systemctl stop caddy >/dev/null 2>&1 || true
    rm -f /etc/caddy/Caddyfile
    log "Previous domain/HTTPS configuration removed."
  fi
}

apply_domain_env() {
  if [[ -n "${DOMAIN}" ]]; then
    upsert_env PUBLIC_DOMAIN "${DOMAIN}"
    upsert_env PUBLIC_HTTPS_PORT "${HTTPS_PORT:-443}"
    if [[ -n "${HTTPS_PORT:-}" && "${HTTPS_PORT}" != "443" ]]; then
      upsert_env BASE_URL "https://${DOMAIN}:${HTTPS_PORT}"
      upsert_env NEXT_PUBLIC_BASE_URL "https://${DOMAIN}:${HTTPS_PORT}"
    else
      upsert_env BASE_URL "https://${DOMAIN}"
      upsert_env NEXT_PUBLIC_BASE_URL "https://${DOMAIN}"
    fi
    upsert_env AUTH_COOKIE_SECURE "true"
  else
    upsert_env PUBLIC_DOMAIN ""
    upsert_env BASE_URL "http://localhost:${PORT}"
    upsert_env NEXT_PUBLIC_BASE_URL "http://localhost:${PORT}"
    upsert_env AUTH_COOKIE_SECURE "false"
  fi
}

prompt_port() {
  local input
  echo
  log "NovaRoute default HTTP port is ${PORT}."
  read -r -p "Press Enter to accept [${PORT}] or type a different port: " input < /dev/tty || true
  if [[ -n "${input}" ]]; then
    if ! [[ "${input}" =~ ^[0-9]+$ ]] || [[ "${input}" -lt 1 ]] || [[ "${input}" -gt 65535 ]]; then
      error "Invalid port: ${input}. Must be 1-65535."
    fi
    PORT="${input}"
  fi
}

# ---------------------------------------------------------------------------
# Detect update vs fresh install
# ---------------------------------------------------------------------------
IS_UPDATE=0
if [[ -d "${INSTALL_DIR}/.git" ]] && [[ -f "${INSTALL_DIR}/package.json" ]]; then
  IS_UPDATE=1
fi

require_root

if [[ "${IS_UPDATE}" -eq 1 ]]; then
  log "=========================================="
  log "  NovaRoute UPDATE"
  log "=========================================="
  # Reuse the port recorded during install (Caddy + summary need it).
  if [[ -f "${INSTALL_DIR}/.env" ]] && grep -q "^PORT=" "${INSTALL_DIR}/.env"; then
    PORT="$(sed -n 's/^PORT=//p' "${INSTALL_DIR}/.env" | head -n1)"
  fi
else
  log "=========================================="
  log "  NovaRoute INSTALL"
  log "=========================================="
  log "  Install dir : ${INSTALL_DIR}"
  log "  Data dir    : ${DATA_DIR}"
  log "  Service     : ${SERVICE_NAME}"
  prompt_port
fi

# Domain + HTTPS port must be decided BEFORE the build:
# NEXT_PUBLIC_BASE_URL is baked into the client bundle at build time.
DOMAIN="${DOMAIN:-}"
HTTPS_PORT="${HTTPS_PORT:-443}"
prompt_domain
validate_domain
prompt_https_port
upsert_env PUBLIC_HTTPS_PORT "${HTTPS_PORT}"

# ---------------------------------------------------------------------------
# Node.js
# ---------------------------------------------------------------------------
if ! node_version_ok; then
  install_nodejs
fi

# Safe logging + hard requirement for npm
if ! command_exists node || ! command_exists npm; then
  error "Node.js or npm is missing. Run the installer again or install them manually."
fi
log "Node.js $(node -v), npm $(npm -v)"

# ---------------------------------------------------------------------------
# Build tools
# ---------------------------------------------------------------------------
install_build_tools

# ---------------------------------------------------------------------------
# Fresh install: dirs, clone, .env
# ---------------------------------------------------------------------------
if [[ "${IS_UPDATE}" -eq 0 ]]; then
  mkdir -p "${INSTALL_DIR}" "${DATA_DIR}/db" "${DATA_DIR}/logs"

  log "Cloning NovaRoute..."
  rm -rf "${INSTALL_DIR}"
  git clone --depth 1 --branch "${BRANCH}" "${REPO_URL}" "${INSTALL_DIR}"
  cd "${INSTALL_DIR}"

  if [[ ! -f "${INSTALL_DIR}/.env" ]]; then
    log "Generating .env..."
    JWT_SECRET="$(secure_random 64)"
    API_KEY_SECRET="$(secure_random 48)"
    MACHINE_ID_SALT="$(secure_random 48)"
    INITIAL_PASSWORD="$(secure_random 16)"

    cat > "${INSTALL_DIR}/.env" <<EOF
JWT_SECRET=${JWT_SECRET}
INITIAL_PASSWORD=${INITIAL_PASSWORD}
DATA_DIR=${DATA_DIR}
PORT=${PORT}
NODE_ENV=production
HOSTNAME=0.0.0.0
API_KEY_SECRET=${API_KEY_SECRET}
MACHINE_ID_SALT=${MACHINE_ID_SALT}
ENABLE_REQUEST_LOGS=false
OBSERVABILITY_ENABLED=true
AUTH_COOKIE_SECURE=false
REQUIRE_API_KEY=true
BASE_URL=http://localhost:${PORT}
NEXT_PUBLIC_BASE_URL=http://localhost:${PORT}
CLOUD_URL=
NEXT_PUBLIC_CLOUD_URL=
EOF
    log "Initial password: ${INITIAL_PASSWORD}"
    log "Save this password - it will not be shown again."
  fi
  apply_domain_env
else
  cd "${INSTALL_DIR}"
  log "Pulling latest code..."
  git fetch origin "${BRANCH}"
  git reset --hard "origin/${BRANCH}"
  git clean -fd

  PREV_DOMAIN="$(current_domain)"
  if [[ -z "${DOMAIN}" && -n "${PREV_DOMAIN}" ]]; then
    # prompt_domain already ran; empty DOMAIN here means the user removed it.
    remove_caddy_domain
  fi
  apply_domain_env
fi

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
log "Installing dependencies..."
npm install --no-audit --no-fund

log "Building..."
npm run build
npm prune --omit=dev --no-audit --no-fund

# ---------------------------------------------------------------------------
# Headless Chromium for the Nova Bot browser tool (optional, best-effort)
# ---------------------------------------------------------------------------
if grep -q '"playwright"' package.json 2>/dev/null; then
  log "Installing headless Chromium (browser tool)..."
  if npx playwright install --with-deps chromium >/dev/null 2>&1; then
    log "Browser tool ready."
  else
    warn "Chromium install failed — browser tool disabled. Retry later:"
    warn "  cd ${INSTALL_DIR} && npx playwright install --with-deps chromium"
  fi
fi

# ---------------------------------------------------------------------------
# systemd
# ---------------------------------------------------------------------------
log "Setting up service..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=NovaRoute AI Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=/usr/bin/node ${INSTALL_DIR}/start.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

sleep 5
if ! systemctl is-active --quiet "${SERVICE_NAME}"; then
  error "Service failed. Check: journalctl -u ${SERVICE_NAME} -n 50"
fi
log "NovaRoute is running on port ${PORT}."

# ---------------------------------------------------------------------------
# Auto-configure providers
# ---------------------------------------------------------------------------
log "Configuring providers..."
for i in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}/api/version" >/dev/null 2>&1; then break; fi
  sleep 1
done

curl -fsS -X POST "http://127.0.0.1:${PORT}/api/setup/free-providers" >/dev/null 2>&1 || true
log "Providers configured."

# ---------------------------------------------------------------------------
# Automatic HTTPS via Caddy (no-op when no domain)
# ---------------------------------------------------------------------------
configure_caddy

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
PUBLIC_IP="$(hostname -I | awk '{print $1}' || echo '127.0.0.1')"
log ""
if [[ "${IS_UPDATE}" -eq 1 ]]; then
  log "=== Update complete ==="
else
  log "=== Install complete ==="
fi
if [[ -n "${DOMAIN}" ]]; then
  if [[ "${HTTPS_PORT}" == "443" ]]; then
    log "Dashboard : https://${DOMAIN}/dashboard"
    log "API       : https://${DOMAIN}/v1"
    log ""
    log "Telegram webhook URL: https://${DOMAIN}/api/dashboard/nova/telegram/webhook"
  else
    log "Dashboard : https://${DOMAIN}:${HTTPS_PORT}/dashboard"
    log "API       : https://${DOMAIN}:${HTTPS_PORT}/v1"
    log ""
    log "Telegram webhook URL: https://${DOMAIN}:${HTTPS_PORT}/api/dashboard/nova/telegram/webhook"
  fi
else
  log "Dashboard : http://${PUBLIC_IP}:${PORT}/dashboard"
  log "API       : http://${PUBLIC_IP}:${PORT}/v1"
fi
log ""
log "The gateway requires an API key: open Dashboard > API Keys and create one"
log "before pointing a client at /v1. The dashboard itself and calls from this"
log "machine keep working without a key."
log ""
log "To update later: re-run this script or use Settings > System & Update"
