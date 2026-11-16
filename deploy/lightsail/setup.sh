#!/usr/bin/env bash
# LeadFlow server for Ubuntu 24.04 (AWS Lightsail): Node 22, PostgreSQL, Caddy for HTTPS, and a
# systemd service that runs the API, the email worker and the web app.
#
# Use it as the instance's launch script, or run it on a server at any time to repair or update it:
#   curl -fsSL https://raw.githubusercontent.com/umer-78/leadflow/main/deploy/lightsail/setup.sh | sudo bash
# It is safe to run again: it keeps the database, the env file and any API keys already in it.
set -Eeuo pipefail
exec > >(tee -a /var/log/leadflow-setup.log) 2>&1
trap 'echo "!! setup failed at line $LINENO: $BASH_COMMAND"' ERR
echo "== $(date -u '+%F %T') LeadFlow setup"
export DEBIAN_FRONTEND=noninteractive

REPO=${LEADFLOW_REPO:-https://github.com/umer-78/leadflow.git}
BRANCH=${LEADFLOW_BRANCH:-main}
HOME_DIR=/opt/leadflow
APP=$HOME_DIR/app
ETC=/etc/leadflow

# 1. Swap: installing and building needs more than the 2 GB of RAM a small server has.
if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
  [ -f /swapfile ] || fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2. Packages. On a new server the automatic updates hold the apt lock for a while, so wait for it.
apt_get() {
  for _ in $(seq 1 30); do apt-get -o DPkg::Lock::Timeout=120 "$@" && return 0; sleep 10; done
  return 1
}
apt_get update -y
apt_get install -y ca-certificates curl gnupg git openssl postgresql debian-keyring debian-archive-keyring apt-transport-https
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt_get install -y nodejs
fi
if ! command -v caddy >/dev/null; then
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt_get update -y
  apt_get install -y caddy
fi
echo "node $(node -v), $(caddy version | cut -d' ' -f1), $(psql --version)"

# 3. The app, as its own user.
id leadflow >/dev/null 2>&1 || useradd --system --home-dir "$HOME_DIR" --shell /usr/sbin/nologin leadflow
mkdir -p "$HOME_DIR" "$ETC"
chown leadflow:leadflow "$HOME_DIR"
as_app() { sudo -u leadflow -H env HOME="$HOME_DIR" "$@"; }
if [ -d "$APP/.git" ]; then
  chown -R leadflow:leadflow "$APP"
  as_app git -C "$APP" fetch --depth 1 origin "$BRANCH"
  as_app git -C "$APP" reset --hard FETCH_HEAD
else
  rm -rf "$APP"
  as_app git clone --depth 1 --branch "$BRANCH" "$REPO" "$APP"
fi
echo "code: $(as_app git -C "$APP" log -1 --format='%h %s')"
(cd "$APP" && as_app npm ci --no-audit --no-fund && as_app npm run build)

# 4. Database: a local PostgreSQL role and database with a generated password.
systemctl enable --now postgresql
if [ ! -s "$ETC/db-password" ]; then
  openssl rand -hex 24 > "$ETC/db-password"
  chmod 600 "$ETC/db-password"
fi
DB_PASSWORD=$(cat "$ETC/db-password")
psql_admin() { sudo -u postgres psql -v ON_ERROR_STOP=1 -qtA "$@"; }
if [ "$(psql_admin -c "SELECT 1 FROM pg_roles WHERE rolname = 'leadflow'")" != 1 ]; then
  psql_admin -c "CREATE ROLE leadflow LOGIN"
fi
psql_admin -c "ALTER ROLE leadflow WITH LOGIN PASSWORD '$DB_PASSWORD'"
if [ "$(psql_admin -c "SELECT 1 FROM pg_database WHERE datname = 'leadflow'")" != 1 ]; then
  sudo -u postgres createdb --owner leadflow leadflow
fi
DATABASE_URL="postgresql://leadflow:$DB_PASSWORD@127.0.0.1:5432/leadflow"

# 5. Address: the domain in /etc/leadflow/domain, else <public-ip>.sslip.io (HTTPS without a domain).
HOST=$(tr -d ' \n' < "$ETC/domain" 2>/dev/null || true)
if [ -z "$HOST" ]; then
  TOKEN=$(curl -fsS --max-time 3 -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' http://169.254.169.254/latest/api/token || true)
  IP=$(curl -fsS --max-time 3 -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 || true)
  [[ "$IP" =~ ^[0-9.]+$ ]] || IP=$(curl -fsS --max-time 10 https://checkip.amazonaws.com | tr -d ' \n')
  HOST="${IP//./-}.sslip.io"
fi
echo "address: https://$HOST"

# 6. Settings. Created once; later runs only refresh the database and public URLs, so API keys
#    added by hand (ANTHROPIC_API_KEY, RESEND_API_KEY, EMAIL_FROM, ...) stay.
if [ ! -f "$ETC/env" ]; then
  printf '%s\n' "NODE_ENV=production" "PORT=3000" "SEED_DEMO=true" > "$ETC/env"
fi
set_env() {
  if grep -q "^$1=" "$ETC/env"; then sed -i "s#^$1=.*#$1=$2#" "$ETC/env"; else echo "$1=$2" >> "$ETC/env"; fi
}
set_env DATABASE_URL "$DATABASE_URL"
set_env PUBLIC_BASE_URL "https://$HOST"
chown root:leadflow "$ETC/env"
chmod 640 "$ETC/env"

# 7. Service, HTTPS and the helper commands DEPLOY.md describes.
cat > /etc/systemd/system/leadflow.service <<UNIT
[Unit]
Description=LeadFlow (API, email worker and web app)
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service
StartLimitIntervalSec=0

[Service]
User=leadflow
WorkingDirectory=$APP
EnvironmentFile=$ETC/env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/caddy/Caddyfile <<CADDY
$HOST {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY
for script in update set-host; do
  printf '%s\n' '#!/usr/bin/env bash' "# Re-runs the setup from the latest code: $script." \
    "exec bash $APP/deploy/lightsail/setup.sh" > "$HOME_DIR/$script.sh"
  chmod 755 "$HOME_DIR/$script.sh"
done
systemctl daemon-reload
systemctl enable leadflow caddy
systemctl restart leadflow
systemctl reload caddy 2>/dev/null || systemctl restart caddy

# 8. Wait for the app, then show where it is.
for _ in $(seq 1 90); do
  curl -fsS --max-time 3 http://127.0.0.1:3000/api/health >/dev/null 2>&1 && break
  sleep 2
done
if curl -fsS --max-time 5 http://127.0.0.1:3000/api/health; then
  echo
  echo "== LeadFlow is running: https://$HOST"
else
  echo "!! LeadFlow did not answer on port 3000. Last log lines:"
  journalctl -u leadflow -n 60 --no-pager
  exit 1
fi
