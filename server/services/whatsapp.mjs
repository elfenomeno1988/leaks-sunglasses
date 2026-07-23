/* ════════════════════════════════════════════════════════════
   LEAKS — Concierge WhatsApp automatique
   Envoi serveur via l'API Cloud de Meta (WhatsApp Business).
   Sans identifiants configurés, le service est dormant et
   l'interface retombe sur la remise wa.me côté client.
   ════════════════════════════════════════════════════════════ */

export const frDate = (iso) => {
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
    `${frDate(b.date)} · ${b.time} — Abidjan`,
    `Référence ${b.reference}`,
    "",
    "Votre créneau privé dure quarante-cinq minutes.",
    "Le lieu vous est communiqué par votre concierge.",
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
    `${frDate(b.date)} · ${b.time} — Abidjan`,
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
    "Abidjan. Retrouvez le lieu dans votre confirmation,",
    "pour un créneau privé de quarante-cinq minutes.",
    "",
    `Référence ${b.reference}. À tout à l'heure.`
  ].join("\n");
}

export function orderPaidMessage(o) {
  return [
    "LEAKS ✦ Votre commande est confirmée.",
    "",
    `${o.product_name} — ${o.variant_name}`,
    `Référence ${o.reference}`,
    "",
    "Nous préparons votre paire. Vous recevrez un message\ndès qu'elle part vers vous, à Abidjan.",
    "",
    "Votre packaging complet accompagne la commande."
  ].filter((l) => l !== null).join("\n");
}

const ORDER_STATUS_LINES = {
  ready: (o) => [
    "LEAKS ✦ Votre paire vous attend.",
    "",
    `${o.product_name} — ${o.variant_name} · ${o.reference}`,
    "",
    "Elle est préparée et sera confiée à la livraison.",
    "Votre concierge vous écrira dès son départ."
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

const ORDER_STATUS_LABELS = {
  ready: "Préparée pour livraison",
  shipped: "En route",
  delivered: "Livrée"
};

export function orderStatusTemplateParameters(status, order) {
  const detail = status === "ready"
    ? "Votre concierge vous écrira dès le départ de la livraison."
    : status === "shipped"
      ? "Le livreur vous appellera à l'approche."
      : "Le concierge reste disponible pour tout ajustage.";
  return [
    ORDER_STATUS_LABELS[status] || status,
    order.product_name,
    order.variant_name,
    order.reference,
    detail
  ];
}

export function bookingUpdateTemplateParameters(label, booking, detail) {
  return [label, frDate(booking.date), booking.time, booking.reference, detail];
}

export function orderAlert(o) {
  return [
    `✦ Commande payée — ${o.reference}`,
    "",
    `${o.product_name} — ${o.variant_name} × ${o.quantity}`,
    `${frAmount(o.total_amount)} · Livraison Abidjan`,
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
    "Un créneau privé de quarante-cinq minutes.",
    "Un mot de votre concierge pour confirmer ?"
  ].filter((l) => l !== null).join("\n");
}

/* ── Client API Cloud ──────────────────────────────────────────── */

export function createWhatsAppNotifier(config, logger = console) {
  const enabled = Boolean(config.WHATSAPP_CLOUD_TOKEN && config.WHATSAPP_PHONE_NUMBER_ID);
  const graph = `https://graph.facebook.com/${config.META_GRAPH_VERSION || "v25.0"}`;
  const templateStatusCache = new Map();

  async function post(payload) {
    const res = await fetch(`${graph}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
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

  /* Meta refuse les retours à la ligne, tabulations et longues suites
     d'espaces dans une variable de modèle. Les alertes internes sont
     naturellement multi-lignes : on les compacte au dernier moment afin
     que les messages déjà présents dans l'outbox soient eux aussi réparés. */
  const templateParameter = (value) => String(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const sendTemplate = (to, name, parameters = []) => post({
    to,
    type: "template",
    template: {
      name,
      language: { code: config.WHATSAPP_TEMPLATE_LANG },
      ...(parameters.length ? {
        components: [{
          type: "body",
          parameters: parameters.map((text) => ({ type: "text", text: templateParameter(text) }))
        }]
      } : {})
    }
  });

  /* Le nom configuré ne suffit pas : un modèle PENDING/REJECTED ne peut pas
     initier une conversation. Ce contrôle court, mis en cache, permet au site
     de conserver le repli wa.me jusqu'au passage réel à APPROVED, puis de
     basculer automatiquement sans nouveau déploiement. */
  async function isTemplateApproved(name) {
    if (!enabled || !config.WHATSAPP_BUSINESS_ACCOUNT_ID || !name) return false;
    const cached = templateStatusCache.get(name);
    if (cached && cached.expiresAt > Date.now()) return cached.approved;

    try {
      const params = new URLSearchParams({
        name,
        fields: "name,status,language",
        limit: "20"
      });
      const res = await fetch(
        `${graph}/${config.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?${params}`,
        {
          headers: { "Authorization": `Bearer ${config.WHATSAPP_CLOUD_TOKEN}` },
          signal: AbortSignal.timeout(2500)
        }
      );
      if (!res.ok) throw new Error(`Meta templates ${res.status}`);
      const payload = await res.json();
      const approved = (payload.data || []).some((template) =>
        template.name === name &&
        template.status === "APPROVED" &&
        (!config.WHATSAPP_TEMPLATE_LANG || template.language === config.WHATSAPP_TEMPLATE_LANG)
      );
      templateStatusCache.set(name, { approved, expiresAt: Date.now() + (approved ? 300_000 : 60_000) });
      return approved;
    } catch (error) {
      logger.warn?.({ error: String(error) }, "Statut du modèle WhatsApp indisponible — repli wa.me");
      templateStatusCache.set(name, { approved: false, expiresAt: Date.now() + 30_000 });
      return false;
    }
  }

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
    sendTemplate,
    sendHelloWorld,
    isTemplateApproved,

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
