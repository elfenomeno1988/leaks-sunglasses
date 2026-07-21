#!/usr/bin/env bash
# LEAKS — installation sur un VPS neuf (Ubuntu 22.04/24.04, ex. Hostinger KVM).
# Usage : bash vps-setup.sh votre-domaine.ci
set -euo pipefail

DOMAIN="${1:?Usage : bash vps-setup.sh votre-domaine.ci}"

echo "── Docker ──────────────────────────────────────────"
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

echo "── Code ────────────────────────────────────────────"
if [ ! -d leaks-sunglasses ]; then
  git clone https://github.com/elfenomeno1988/leaks-sunglasses.git
fi
cd leaks-sunglasses

if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠  Remplissez .env (secrets, WhatsApp, PayDunya) puis relancez ce script."
  exit 1
fi

echo "── Application ─────────────────────────────────────"
docker compose up -d --build

echo "── HTTPS (Caddy) ───────────────────────────────────"
mkdir -p /etc/caddy
cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN} {
  reverse_proxy localhost:3000
}
EOF
docker rm -f leaks-caddy 2>/dev/null || true
docker run -d --name leaks-caddy --network host --restart unless-stopped \
  -v /etc/caddy/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy_data:/data caddy:2-alpine

echo
echo "✔ LEAKS en ligne : https://${DOMAIN}"
echo "  (pointez le DNS A de ${DOMAIN} vers ce serveur au préalable)"
echo "  Compte admin : docker compose exec app node server/scripts/create-admin.mjs admin@leaks.ci <mot-de-passe>"
