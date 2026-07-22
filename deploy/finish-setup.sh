#!/usr/bin/env bash
# LEAKS — finalisation de la prod (WhatsApp + admin) en une commande.
# Usage :
#   curl -fsSL https://raw.githubusercontent.com/elfenomeno1988/leaks-sunglasses/main/deploy/finish-setup.sh \
#     | bash -s -- 'JETON_WHATSAPP' [email_admin] [mot_de_passe_admin]
set -euo pipefail

TOKEN="${WHATSAPP_CLOUD_TOKEN:-${1:-}}"
: "${TOKEN:?Il manque le jeton WhatsApp (utilisez la variable WHATSAPP_CLOUD_TOKEN)}"
ADMIN_EMAIL="${2:-admin@leaks.ci}"
ADMIN_PASS="${3:-$(openssl rand -base64 12 | tr -d '=+/' | cut -c1-14)-Lk1}"

cd /root/leaks-sunglasses
echo "══════════ LEAKS — finalisation ══════════"
git pull --ff-only 2>/dev/null || true

set_var() {
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}

echo "→ Configuration WhatsApp…"
set_var WHATSAPP_CLOUD_TOKEN "$TOKEN"
set_var WHATSAPP_PHONE_NUMBER_ID "1239914522534675"
set_var WHATSAPP_NUMBER "2250173891404"
set_var WHATSAPP_CONCIERGE_NUMBER "2250173891404"
set_var WHATSAPP_TEMPLATE_BOOKING "leaks_confirmation_rdv"
set_var WHATSAPP_TEMPLATE_ORDER "leaks_confirmation_commande"
set_var WHATSAPP_TEMPLATE_BOOKING_UPDATE "leaks_suivi_rdv"
set_var WHATSAPP_TEMPLATE_ORDER_UPDATE "leaks_suivi_commande"
set_var WHATSAPP_TEMPLATE_CONCIERGE_ALERT "leaks_alerte_concierge"
set_var WHATSAPP_TEMPLATE_LANG "fr"
WEBHOOK_TOKEN="$(grep '^WHATSAPP_WEBHOOK_VERIFY_TOKEN=' .env 2>/dev/null | cut -d= -f2- || true)"
if [ -z "$WEBHOOK_TOKEN" ]; then WEBHOOK_TOKEN="$(openssl rand -hex 24)"; fi
set_var WHATSAPP_WEBHOOK_VERIFY_TOKEN "$WEBHOOK_TOKEN"

if [ -n "${WHATSAPP_APP_SECRET:-}" ]; then
  set_var WHATSAPP_APP_SECRET "$WHATSAPP_APP_SECRET"
fi

echo "→ Redémarrage de l'application…"
docker compose up -d --build --remove-orphans >/dev/null 2>&1
sleep 8

echo "→ Compte administrateur…"
docker compose exec -T app node server/scripts/create-admin.mjs "$ADMIN_EMAIL" "$ADMIN_PASS" </dev/null || true

echo "→ Test d'envoi WhatsApp réel (vers le numéro concierge)…"
if docker compose exec -T app node server/scripts/whatsapp-test.mjs 2250173891404 </dev/null; then WA_OK=oui; else WA_OK=non; fi

IP=$(curl -4 -s ifconfig.me 2>/dev/null || echo "IP_DU_VPS")
echo
echo "══════════════════════════════════════════"
echo "✔ Configuration terminée."
echo
echo "  Site        : http://${IP}:3000"
echo "  Admin       : http://${IP}:3000/admin.html"
echo "  Email admin : ${ADMIN_EMAIL}"
echo "  Mot de passe: ${ADMIN_PASS}   ← NOTEZ-LE puis changez-le si besoin"
echo "  WhatsApp    : envoi test $([ "$WA_OK" = oui ] && echo 'PARTI ✔ — regardez votre téléphone' || echo 'ÉCHOUÉ — jeton invalide ou expiré ?')"
echo "══════════════════════════════════════════"
