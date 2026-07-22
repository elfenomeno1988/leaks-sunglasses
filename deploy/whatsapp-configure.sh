#!/usr/bin/env bash
# LEAKS — aligne la configuration WhatsApp sans exposer les secrets.
# Les secrets déjà présents sont conservés. S'ils manquent, la saisie est masquée.
set -Eeuo pipefail

REPO_DIR="${LEAKS_REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$REPO_DIR"
[ -f .env ] || { echo "Fichier .env absent." >&2; exit 1; }

get_env() {
  awk -F= -v key="$1" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' .env
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

cloud_token="$(get_env WHATSAPP_CLOUD_TOKEN)"
app_secret="$(get_env WHATSAPP_APP_SECRET)"

if [ -z "$cloud_token" ]; then
  read -rsp "Jeton permanent WhatsApp Cloud : " cloud_token
  echo
fi
if [ -z "$app_secret" ]; then
  read -rsp "Clé secrète de l'app Meta : " app_secret
  echo
fi
[ -n "$cloud_token" ] && [ -n "$app_secret" ] || {
  echo "Les deux secrets WhatsApp sont requis." >&2
  exit 1
}

set_env WHATSAPP_CLOUD_TOKEN "$cloud_token"
set_env WHATSAPP_APP_SECRET "$app_secret"
set_env WHATSAPP_PHONE_NUMBER_ID "1239914522534675"
set_env WHATSAPP_BUSINESS_ACCOUNT_ID "821478214384181"
set_env META_GRAPH_VERSION "v25.0"
set_env WHATSAPP_CONCIERGE_NUMBER "2250173891404"
set_env WHATSAPP_TEMPLATE_BOOKING "leaks_confirmation_rdv"
set_env WHATSAPP_TEMPLATE_ORDER "leaks_confirmation_commande"
set_env WHATSAPP_TEMPLATE_BOOKING_UPDATE "leaks_suivi_rdv"
set_env WHATSAPP_TEMPLATE_ORDER_UPDATE "leaks_suivi_commande"
set_env WHATSAPP_TEMPLATE_CONCIERGE_ALERT "leaks_alerte_concierge"
set_env WHATSAPP_TEMPLATE_LANG "fr"

verify_token="$(get_env WHATSAPP_WEBHOOK_VERIFY_TOKEN)"
if [ -z "$verify_token" ]; then
  verify_token="$(openssl rand -hex 24)"
  set_env WHATSAPP_WEBHOOK_VERIFY_TOKEN "$verify_token"
fi

compose_profiles=()
if grep -Eq '^LEAKS_DOMAIN=.+$' .env; then compose_profiles=(--profile edge); fi
docker compose "${compose_profiles[@]}" up -d --build app

echo "✔ Configuration locale WhatsApp alignée."
echo "  Callback : $(get_env PUBLIC_SITE_URL)/api/whatsapp/webhook"
echo "  Le jeton de vérification reste privé dans .env."
echo "  Après l'abonnement Meta : docker compose exec -T app npm run wa:ready -- --strict"
