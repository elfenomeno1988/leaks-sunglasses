#!/usr/bin/env bash
# LEAKS — active le domaine et le HTTPS Caddy sur un VPS déjà déployé.
# Usage : sudo bash deploy/domain-setup.sh leaksthebrand.com
set -Eeuo pipefail

DOMAIN="${1:-}"
REPO_DIR="${LEAKS_REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"

[[ "$DOMAIN" =~ ^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$ ]] && [[ "$DOMAIN" != *..* ]] || {
  echo "Domaine invalide : $DOMAIN" >&2
  exit 1
}

cd "$REPO_DIR"
[ -f .env ] || { echo "Fichier .env absent." >&2; exit 1; }

server_ip="$(curl -4 -fsS https://ifconfig.me)"
domain_ip="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1 {print $1}')"
www_ip="$(getent ahostsv4 "www.$DOMAIN" | awk 'NR==1 {print $1}')"
[ "$domain_ip" = "$server_ip" ] && [ "$www_ip" = "$server_ip" ] || {
  echo "DNS non prêt : $DOMAIN=${domain_ip:-rien}, www.$DOMAIN=${www_ip:-rien}, attendu $server_ip." >&2
  echo "Ajoutez d'abord les enregistrements A de @ et www vers $server_ip." >&2
  exit 1
}

set_env() {
  local key="$1" value="$2" temporary
  temporary="$(mktemp "${TMPDIR:-/tmp}/leaks-env.XXXXXX")"
  awk -v key="$key" -v value="$value" '
    BEGIN { changed = 0 }
    index($0, key "=") == 1 { print key "=" value; changed = 1; next }
    { print }
    END { if (!changed) print key "=" value }
  ' .env > "$temporary"
  chmod --reference=.env "$temporary" 2>/dev/null || chmod 600 "$temporary"
  mv "$temporary" .env
}

set_env LEAKS_DOMAIN "$DOMAIN"
set_env PUBLIC_SITE_URL "https://$DOMAIN"
set_env APP_BIND_IP "127.0.0.1"

docker compose --profile edge up -d --remove-orphans

for _ in $(seq 1 30); do
  if curl -fsS "https://$DOMAIN/health" >/dev/null 2>&1; then
    echo "✔ https://$DOMAIN est actif."
    exit 0
  fi
  sleep 2
done

docker compose logs --tail=120 caddy >&2 || true
echo "HTTPS ne répond pas encore. Vérifiez que les ports 80/443 sont autorisés." >&2
exit 1
