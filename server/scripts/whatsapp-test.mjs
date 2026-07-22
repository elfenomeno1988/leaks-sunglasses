/* Vérifie les identifiants WhatsApp Cloud en envoyant un message réel.
   Usage :  npm run wa:test -- 2250700000000
   (numéro au format international, sans « + » ni espaces)              */

import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { loadConfig } from "../config.mjs";
import { createWhatsAppNotifier, customerMessage, frDate } from "../services/whatsapp.mjs";

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

/* Un numéro professionnel ne peut pas envoyer le template hello_world : Meta
   le réserve à ses numéros de test publics. Par défaut, on envoie donc le
   véritable modèle LEAKS configuré. --hello-world reste disponible uniquement
   pour un numéro de test Meta ; --text sert dans une fenêtre client de 24 h. */
const useText = process.argv.includes("--text");
const useHelloWorld = process.argv.includes("--hello-world");

try {
  let result;
  let mode;
  if (useText) {
    result = await wa.sendText(to, customerMessage(demo));
    mode = "texte LEAKS";
  } else if (useHelloWorld) {
    result = await wa.sendHelloWorld(to);
    mode = "template hello_world (numéro de test Meta uniquement)";
  } else {
    if (!config.WHATSAPP_TEMPLATE_BOOKING) {
      throw new Error("WHATSAPP_TEMPLATE_BOOKING n'est pas configuré.");
    }
    result = await wa.sendTemplate(to, config.WHATSAPP_TEMPLATE_BOOKING, [
      frDate(demo.date), demo.time, demo.reference
    ]);
    mode = `template ${config.WHATSAPP_TEMPLATE_BOOKING}`;
  }
  console.log(`✦ Message parti (${mode}). Réponse Meta :`);
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
