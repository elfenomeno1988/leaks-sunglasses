/* Vérifie les identifiants WhatsApp Cloud en envoyant un message réel.
   Usage :  npm run wa:test -- 2250700000000
   (numéro au format international, sans « + » ni espaces)              */

import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { loadConfig } from "../config.mjs";
import { createWhatsAppNotifier, customerMessage } from "../services/whatsapp.mjs";

const to = String(process.argv[2] || "").replace(/\D/g, "");

if (!to) {
  console.error("Usage : npm run wa:test -- 2250700000000");
  process.exit(1);
}

const config = loadConfig();
const wa = createWhatsAppNotifier(config, console);

if (!wa.enabled) {
  console.error(
    "Identifiants absents.\n" +
    "Renseignez WHATSAPP_CLOUD_TOKEN et WHATSAPP_PHONE_NUMBER_ID dans .env\n" +
    "(voir GUIDE-WHATSAPP.md), puis relancez."
  );
  process.exit(1);
}

const demo = {
  reference: "LK-RDV-TEST",
  date: new Date().toISOString().slice(0, 10),
  time: "15:00",
  name: "Test LEAKS",
  phone: `+${to}`,
  note: ""
};

/* En mode test, le premier message doit être un template. On envoie donc
   « hello_world » (connexion), sauf si --text est passé pour forcer le texte. */
const useText = process.argv.includes("--text");

try {
  const result = useText
    ? await wa.sendText(to, customerMessage(demo))
    : await wa.sendHelloWorld(to);
  console.log(`✦ Message parti (${useText ? "texte LEAKS" : "template hello_world"}). Réponse Meta :`);
  console.log(JSON.stringify(result, null, 2));
  console.log("\nRegardez WhatsApp sur le numéro destinataire — le message doit y être.");
} catch (error) {
  console.error("Échec de l'envoi :\n" + String(error.message || error));
  console.error(
    "\nPistes : jeton expiré (les jetons temporaires durent 24 h), numéro destinataire\n" +
    "non enregistré comme testeur (mode test), ou Phone Number ID incorrect."
  );
  process.exit(1);
}
