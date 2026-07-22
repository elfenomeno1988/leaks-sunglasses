/* Vérification non destructive de l'intégration WhatsApp Cloud.
   Ne journalise jamais le jeton ni la clé secrète.
   Usage : npm run wa:ready [-- --strict] */

import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { loadConfig } from "../config.mjs";

const config = loadConfig();
const strict = process.argv.includes("--strict");
const graph = `https://graph.facebook.com/${config.META_GRAPH_VERSION}`;
const templates = {
  booking: config.WHATSAPP_TEMPLATE_BOOKING,
  order: config.WHATSAPP_TEMPLATE_ORDER,
  bookingUpdate: config.WHATSAPP_TEMPLATE_BOOKING_UPDATE,
  orderUpdate: config.WHATSAPP_TEMPLATE_ORDER_UPDATE,
  conciergeAlert: config.WHATSAPP_TEMPLATE_CONCIERGE_ALERT
};

const readiness = {
  graphVersion: config.META_GRAPH_VERSION,
  tokenConfigured: Boolean(config.WHATSAPP_CLOUD_TOKEN),
  phoneIdConfigured: Boolean(config.WHATSAPP_PHONE_NUMBER_ID),
  businessAccountIdConfigured: Boolean(config.WHATSAPP_BUSINESS_ACCOUNT_ID),
  appSecretConfigured: Boolean(config.WHATSAPP_APP_SECRET),
  webhookVerifyTokenConfigured: Boolean(config.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
  templatesConfigured: Object.values(templates).every(Boolean),
  phone: null,
  webhookSubscribed: null
};

if (!readiness.tokenConfigured || !readiness.phoneIdConfigured) {
  console.log(JSON.stringify(readiness, null, 2));
  console.error("Identifiants WhatsApp Cloud incomplets.");
  process.exit(1);
}

async function graphGet(path) {
  const response = await fetch(`${graph}/${path}`, {
    headers: { Authorization: `Bearer ${config.WHATSAPP_CLOUD_TOKEN}` }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Meta Graph : ${message}`);
  }
  return body;
}

try {
  const phone = await graphGet(
    `${config.WHATSAPP_PHONE_NUMBER_ID}?fields=id,display_phone_number,verified_name,quality_rating`
  );
  readiness.phone = {
    id: phone.id || null,
    displayNumber: phone.display_phone_number || null,
    verifiedName: phone.verified_name || null,
    qualityRating: phone.quality_rating || null
  };

  if (config.WHATSAPP_BUSINESS_ACCOUNT_ID) {
    const subscriptions = await graphGet(`${config.WHATSAPP_BUSINESS_ACCOUNT_ID}/subscribed_apps`);
    readiness.webhookSubscribed = Array.isArray(subscriptions.data) && subscriptions.data.length > 0;
  }

  console.log(JSON.stringify(readiness, null, 2));
  const strictReady = readiness.appSecretConfigured &&
    readiness.webhookVerifyTokenConfigured && readiness.templatesConfigured &&
    readiness.webhookSubscribed === true;
  if (strict && !strictReady) {
    console.error("L'intégration WhatsApp n'est pas encore complète.");
    process.exit(2);
  }
} catch (error) {
  console.log(JSON.stringify(readiness, null, 2));
  console.error(String(error.message || error));
  process.exit(1);
}
