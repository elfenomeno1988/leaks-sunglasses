#!/usr/bin/env bash
# LEAKS — installation d'un coup sur un VPS Ubuntu neuf.
# Usage (sur le VPS, en root) :
#   curl -fsSL https://raw.githubusercontent.com/elfenomeno1988/leaks-sunglasses/main/deploy/bootstrap.sh | bash
set -euo pipefail

echo "══════════ LEAKS — installation ══════════"

# 1. Docker (si absent)
if ! command -v docker >/dev/null 2>&1; then
  echo "→ Installation de Docker…"
  curl -fsSL https://get.docker.com | sh
fi

# 2. Le code
cd /root
if [ ! -d leaks-sunglasses ]; then
  echo "→ Récupération du code…"
  git clone https://github.com/elfenomeno1988/leaks-sunglasses.git
fi
cd leaks-sunglasses
git pull --ff-only 2>/dev/null || true

# 3. Configuration de production (créée une seule fois)
if [ ! -f .env ]; then
  echo "→ Configuration initiale…"
  # -4 : IPv4 uniquement (une IPv6 contient des « : » → URL invalide)
  IP=$(curl -4 -s ifconfig.me 2>/dev/null || true)
  case "$IP" in
    *[!0-9.]*|"") IP="localhost" ;;
  esac
  cat > .env <<EOF
NODE_ENV=production
PORT=3000
PUBLIC_SITE_URL=http://${IP}
DATABASE_URL=postgres://leaks:leaks@db:5432/leaks
COOKIE_SECRET=$(openssl rand -hex 32)
PAYDUNYA_MODE=test
PAYDUNYA_MASTER_KEY=a-configurer
PAYDUNYA_PRIVATE_KEY=a-configurer
PAYDUNYA_TOKEN=a-configurer
WHATSAPP_NUMBER=2250173891404
DELIVERY_ABIDJAN_FEE=1000
ORDER_OPEN_AT=2026-07-24T00:00:00Z
EOF
fi

# 4. Lancement (app + PostgreSQL, migrations au démarrage)
echo "→ Construction et démarrage (quelques minutes la première fois)…"
docker compose up -d --build --remove-orphans

# 5. Vérification
echo "→ Vérification…"
sleep 10
for i in $(seq 1 12); do
  if curl -fs http://localhost:3000/health >/dev/null 2>&1; then break; fi
  sleep 5
done

IP=$(curl -4 -s ifconfig.me 2>/dev/null || echo "IP_DU_VPS")
echo
echo "══════════════════════════════════════════"
if curl -fs http://localhost:3000/health >/dev/null 2>&1; then
  echo "✔ LEAKS est EN LIGNE : http://${IP}:3000"
  echo "  (app mobile : http://${IP}:3000/m.html)"
else
  echo "⚠ Le service ne répond pas encore. Voir : docker compose logs -f app"
fi
echo "══════════════════════════════════════════"
