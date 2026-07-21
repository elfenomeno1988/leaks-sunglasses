/* ════════════════════════════════════════════════════════════
   LEAKS — Concierge WhatsApp automatique
   Envoi serveur via l'API Cloud de Meta (WhatsApp Business).
   Sans identifiants configurés, le service est dormant et
   l'interface retombe sur la remise wa.me côté client.
   ════════════════════════════════════════════════════════════ */

const GRAPH = "https://graph.facebook.com/v20.0";

const frDate = (iso) => {
  const s = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC"
  }).format(new Date(`${iso}T00:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* ── Copywriting — la voix LEAKS : brève, précise, au service ── */

export function customerMessage(b) {
  return [
    "LEAKS ✦ Votre essayage privé est retenu.",
    "",
    `${frDate(b.date)} · ${b.time} — LEAKS Studio, Abidjan`,
    `Référence ${b.reference}`,
    "",
    "Le studio vous appartient quarante-cinq minutes,",
    "les sept signatures posées devant vous.",
    "",
    "Un empêchement, une envie particulière ?",
    "Répondez à ce message — votre concierge vous lit."
  ].join("\n");
}

export function conciergeAlert(b) {
  return [
    `✦ Nouveau rendez-vous — ${b.reference}`,
    "",
    `${frDate(b.date)} · ${b.time}`,
    `${b.name} — ${b.phone}`,
    b.note ? `Note : ${b.note}` : null,
    "",
    "Confirmer au client sous 15 minutes."
  ].filter((l) => l !== null).join("\n");
}

/* Le message que le client envoie lui-même quand l'API n'est pas là.
   Servi à l'interface pour que desktop et mobile parlent d'une voix. */
export function handoffMessage(b) {
  return [
    "Bonjour LEAKS ✦ Essayage privé",
    "",
    "Ma carte de rendez-vous :",
    `· ${b.reference}`,
    `· ${frDate(b.date)} · ${b.time}`,
    `· ${b.name} — ${b.phone}`,
    b.note ? `· Note : ${b.note}` : null,
    "",
    "Quarante-cinq minutes, le studio pour moi seul.",
    "Un mot de votre concierge pour confirmer ?"
  ].filter((l) => l !== null).join("\n");
}

/* ── Client API Cloud ──────────────────────────────────────────── */

export function createWhatsAppNotifier(config, logger = console) {
  const enabled = Boolean(config.WHATSAPP_CLOUD_TOKEN && config.WHATSAPP_PHONE_NUMBER_ID);

  async function sendText(to, body) {
    const res = await fetch(`${GRAPH}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.WHATSAPP_CLOUD_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body }
      })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`WhatsApp Cloud ${res.status}: ${detail.slice(0, 300)}`);
    }
    return res.json();
  }

  return {
    enabled,

    /* Fire-and-forget : une réservation n'échoue jamais parce que
       la notification n'est pas partie. */
    async notifyBooking(booking) {
      if (!enabled) return { delivery: "handoff" };
      const to = String(booking.phone || "").replace(/\D/g, "");
      try {
        await sendText(to, customerMessage(booking));
        sendText(config.WHATSAPP_CONCIERGE_NUMBER, conciergeAlert(booking))
          .catch((error) => logger.warn?.({ error: String(error) }, "Alerte concierge non délivrée"));
        return { delivery: "sent" };
      } catch (error) {
        logger.warn?.({ error: String(error) }, "Envoi WhatsApp client échoué — remise wa.me");
        return { delivery: "handoff" };
      }
    }
  };
}
