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

const frAmount = (n) => `${new Intl.NumberFormat("fr-FR").format(n)} F`;

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

export function bookingConfirmedMessage(b) {
  return [
    "LEAKS ✦ Votre créneau est confirmé.",
    "",
    `${frDate(b.date)} · ${b.time} — LEAKS Studio, Abidjan`,
    `Référence ${b.reference}`,
    "",
    "Le concierge vous attend. Un empêchement ?",
    "Répondez simplement à ce message."
  ].join("\n");
}

export function bookingReminderMessage(b) {
  return [
    "LEAKS ✦ C'est aujourd'hui.",
    "",
    `Votre essayage privé vous attend à ${b.time} —`,
    "LEAKS Studio, Abidjan. Le studio est à vous,",
    "quarante-cinq minutes, les sept signatures posées.",
    "",
    `Référence ${b.reference}. À tout à l'heure.`
  ].join("\n");
}

export function orderPaidMessage(o) {
  const serial = o.serial_number
    ? `Votre exemplaire : Nº ${String(o.serial_number).padStart(2, "0")}${o.edition_size ? ` / ${o.edition_size}` : ""}`
    : null;
  return [
    "LEAKS ✦ Votre commande est confirmée.",
    "",
    `${o.product_name} — ${o.variant_name}`,
    `Référence ${o.reference}`,
    serial,
    "",
    o.delivery_method === "pickup"
      ? "Nous préparons votre paire. Vous recevrez un message\ndès qu'elle vous attend au studio."
      : "Nous préparons votre paire. Vous recevrez un message\ndès qu'elle part vers vous, à Abidjan.",
    "",
    "Chaque paire est gravée de son numéro — la vôtre existe déjà."
  ].filter((l) => l !== null).join("\n");
}

const ORDER_STATUS_LINES = {
  ready: (o) => [
    "LEAKS ✦ Votre paire vous attend.",
    "",
    `${o.product_name} — ${o.variant_name} · ${o.reference}`,
    "",
    "Elle est posée au studio, gravée à votre numéro.",
    "LEAKS Studio — Abidjan · Lun – Sam · 10 h → 19 h.",
    "Présentez simplement ce message."
  ],
  shipped: (o) => [
    "LEAKS ✦ Votre paire est en route.",
    "",
    `${o.product_name} — ${o.variant_name} · ${o.reference}`,
    "",
    "Livraison à Abidjan en cours. Le livreur vous",
    "appellera à l'approche."
  ],
  delivered: (o) => [
    "LEAKS ✦ Elle est à vous.",
    "",
    `${o.product_name} — ${o.variant_name} · ${o.reference}`,
    "",
    "Portez-la bien. Une question, un ajustage —",
    "le concierge reste à votre écoute, toujours ici."
  ]
};

export function orderStatusMessage(status, order) {
  const lines = ORDER_STATUS_LINES[status];
  return lines ? lines(order).join("\n") : null;
}

export function orderAlert(o) {
  return [
    `✦ Commande payée — ${o.reference}`,
    "",
    `${o.product_name} — ${o.variant_name} × ${o.quantity}`,
    `${frAmount(o.total_amount)} · ${o.delivery_method === "pickup" ? "Retrait studio" : "Livraison Abidjan"}`,
    `${o.customer_name} — ${o.customer_phone}`,
    o.delivery_address ? `Adresse : ${o.delivery_address}` : null,
    o.customer_note ? `Note : ${o.customer_note}` : null
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

  async function post(payload) {
    const res = await fetch(`${GRAPH}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.WHATSAPP_CLOUD_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`WhatsApp Cloud ${res.status}: ${detail.slice(0, 300)}`);
    }
    return res.json();
  }

  const sendText = (to, body) => post({ to, type: "text", text: { preview_url: false, body } });

  /* Template de confirmation — seul format accepté par Meta pour un
     message à l'initiative de la marque hors fenêtre de 24 h. */
  const sendBookingTemplate = (to, b) => post({
    to,
    type: "template",
    template: {
      name: config.WHATSAPP_TEMPLATE_BOOKING,
      language: { code: config.WHATSAPP_TEMPLATE_LANG },
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: frDate(b.date) },
          { type: "text", text: b.time },
          { type: "text", text: b.reference }
        ]
      }]
    }
  });

  /* Client : template si configuré, sinon texte libre
     (valable en mode test et dans la fenêtre de 24 h). */
  async function sendCustomer(to, booking) {
    if (config.WHATSAPP_TEMPLATE_BOOKING) {
      try { return await sendBookingTemplate(to, booking); }
      catch (error) {
        logger.warn?.({ error: String(error) }, "Template refusé — tentative en texte libre");
      }
    }
    return sendText(to, customerMessage(booking));
  }

  /* Template pré-approuvé « hello_world » — sert à prouver la connexion
     en mode test, où le texte libre est refusé au premier contact. */
  const sendHelloWorld = (to) => post({
    to,
    type: "template",
    template: { name: "hello_world", language: { code: "en_US" } }
  });

  return {
    enabled,
    sendText,
    sendHelloWorld,

    /* Fire-and-forget : une réservation n'échoue jamais parce que
       la notification n'est pas partie. */
    async notifyBooking(booking) {
      if (!enabled) return { delivery: "handoff" };
      const to = String(booking.phone || "").replace(/\D/g, "");
      try {
        await sendCustomer(to, booking);
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
