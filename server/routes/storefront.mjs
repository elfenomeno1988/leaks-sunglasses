import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createOrder, publicOrder } from "../services/orders.mjs";
import { createBooking, confirmBooking, bookedSlots, publicBooking } from "../services/bookings.mjs";
import { handoffMessage, customerMessage, conciergeAlert, orderPaidMessage, orderAlert } from "../services/whatsapp.mjs";

const trackingSchema = z.object({
  reference: z.string().min(8).max(40),
  tracking: z.string().uuid()
});

const bookingConfirmationSchema = z.object({
  reference: z.string().regex(/^LK-RDV-[A-F0-9]{4}$/),
  token: z.string().uuid()
});

export function verifyMetaSignature(secret, rawBody, signature) {
  if (!secret || typeof rawBody !== "string" || typeof signature !== "string") return false;
  const match = /^sha256=([a-f0-9]{64})$/i.exec(signature);
  if (!match) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(match[1], "hex"));
}

export function bookingWhatsAppDelivery(cloudEnabled, templateConfigured) {
  return cloudEnabled && templateConfigured ? "queued" : "handoff";
}

export async function storefrontRoutes(app, deps) {
  const { db, catalog, config, paydunya, whatsapp, notify } = deps;

  app.get("/api/catalog", async () => {
    const inventory = await db.query(
      `select product_id, variant_id, coalesce(sum(quantity), 0)::int as reserved
       from orders
       where status <> 'cancelled'
         and payment_status not in ('failed', 'cancelled', 'refunded')
         and (payment_status <> 'pending' or payment_expires_at > now())
       group by product_id, variant_id`
    );
    const reservedByVariant = new Map(inventory.rows.map((row) => [
      `${row.product_id}:${row.variant_id}`,
      Number(row.reserved) || 0
    ]));
    const products = catalog.list.map((p) => ({
      ...p,
      variants: p.variants.map((v) => ({
        ...v,
        editionSize: p.tier === "accessory"
          ? null
          : Number(v.editionSize || catalog.defaultEditionSize || 2),
        remaining: p.tier === "accessory"
          ? null
          : Math.max(
            0,
            Number(v.editionSize || catalog.defaultEditionSize || 2)
              - (reservedByVariant.get(`${p.id}:${v.id}`) || 0)
          )
      }))
    }));

    return {
      currency: catalog.currency,
      maxOrderQuantity: catalog.maxOrderQuantity || 2,
      defaultEditionSize: catalog.defaultEditionSize || 2,
      editionLabel: catalog.editionLabel || "50 exemplaires au total",
      dropAt: catalog.dropAt || null,
      orderOpenAt: config.ORDER_OPEN_AT || catalog.orderOpenAt || null,
      deliveryFees: { abidjan_delivery: config.DELIVERY_ABIDJAN_FEE },
      freeDeliveryTiers: ["exclusive"],
      paymentMethods: config.paydunyaConfigured
        ? ["wave", "mobile_money", "card"]
        : ["whatsapp_wave"],
      products
    };
  });

  app.post("/api/orders", {
    config: { rateLimit: { max: 8, timeWindow: "10 minutes" } }
  }, async (request, reply) => {
    const result = await createOrder({ db, catalog, config, paydunya, input: request.body });
    return reply.code(201).send({
      order: publicOrder(result.order),
      trackingToken: result.trackingToken,
      redirectUrl: result.redirectUrl,
      manual: result.manual
    });
  });

  app.get("/api/bookings/availability", async (request, reply) => {
    const date = String(request.query.date || "");
    /* Une vraie date du calendrier — « 2026-99-99 » passait le regex
       et finissait en erreur 500 côté Postgres. */
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime())
        || parsed.toISOString().slice(0, 10) !== date) {
      return reply.code(400).send({ error: "Date invalide." });
    }
    return { date, booked: await bookedSlots({ db, date }) };
  });

  app.post("/api/bookings", {
    config: { rateLimit: { max: 6, timeWindow: "10 minutes" } }
  }, async (request, reply) => {
    const row = await createBooking({ db, catalog, input: request.body });
    const booking = {
      reference: row.reference,
      date: row.booking_date instanceof Date ? row.booking_date.toISOString().slice(0, 10) : String(row.booking_date),
      time: row.booking_time,
      name: row.customer_name,
      phone: row.customer_phone,
      address: row.customer_address,
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
      note: row.customer_note || ""
    };
    /* Un contrôle de statut Meta indisponible ne doit jamais renvoyer le
       client vers un envoi manuel. Dès que Cloud + le modèle sont configurés,
       la confirmation entre dans l'outbox persistante et sera rejouée jusqu'à
       sa livraison. Le worker reste l'autorité sur le résultat réel. */
    const bookingTemplateConfigured = Boolean(config.WHATSAPP_TEMPLATE_BOOKING);
    /* La confirmation et l'alerte passent par la file : envoi immédiat,
       reprises automatiques, jamais deux fois (dédoublonnage par référence). */
    await notify.enqueue("booking-confirmation", booking.phone, customerMessage(booking), booking.reference,
      config.WHATSAPP_TEMPLATE_BOOKING ? {
        name: config.WHATSAPP_TEMPLATE_BOOKING,
        parameters: [
          new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
            .format(new Date(`${booking.date}T00:00:00Z`)),
          booking.time,
          booking.reference
        ]
      } : null);
    const bookingAlert = conciergeAlert(booking);
    await notify.enqueue("booking-alert", config.WHATSAPP_CONCIERGE_NUMBER, bookingAlert, booking.reference,
      config.WHATSAPP_TEMPLATE_CONCIERGE_ALERT ? {
        name: config.WHATSAPP_TEMPLATE_CONCIERGE_ALERT,
        parameters: ["Nouveau rendez-vous", booking.reference, bookingAlert]
      } : null);
    return reply.code(201).send({
      booking: publicBooking(row, { includeConfirmationToken: true }),
      whatsapp: {
        /* La requête ne prétend plus que Meta a livré le message : le worker
           l'envoie juste après la réponse et conserve les reprises en base. */
        delivery: bookingWhatsAppDelivery(whatsapp.enabled, bookingTemplateConfigured),
        conciergeNumber: config.WHATSAPP_NUMBER,
        handoffText: handoffMessage(booking)             // la carte, déjà écrite
      }
    });
  });

  app.post("/api/bookings/:reference/confirm", {
    config: { rateLimit: { max: 10, timeWindow: "10 minutes" } }
  }, async (request, reply) => {
    const parsed = bookingConfirmationSchema.safeParse({
      reference: request.params.reference,
      token: request.body?.token
    });
    if (!parsed.success) {
      return reply.code(400).send({ error: "Lien de confirmation invalide." });
    }

    const row = await confirmBooking({
      db,
      reference: parsed.data.reference,
      token: parsed.data.token
    });
    const date = row.booking_date instanceof Date
      ? row.booking_date.toISOString().slice(0, 10)
      : String(row.booking_date);
    const alert = [
      `✦ Rendez-vous confirmé par le client — ${row.reference}`,
      `${row.customer_name} — ${row.customer_phone}`,
      `${date} · ${row.booking_time}`,
      `Adresse : ${row.customer_address}`,
      row.latitude != null && row.longitude != null
        ? `Itinéraire : https://www.google.com/maps?q=${row.latitude},${row.longitude}`
        : null
    ].filter((line) => line !== null).join("\n");
    await notify.enqueue(
      "booking-client-confirmed",
      config.WHATSAPP_CONCIERGE_NUMBER,
      alert,
      row.reference,
      config.WHATSAPP_TEMPLATE_CONCIERGE_ALERT ? {
        name: config.WHATSAPP_TEMPLATE_CONCIERGE_ALERT,
        parameters: ["Rendez-vous confirmé", row.reference, alert]
      } : null
    );
    return reply.send({ booking: publicBooking(row) });
  });

  /* ── Webhook WhatsApp Cloud (vérification + accusés + réponses) ── */

  /* Meta place le jeton de vérification dans la query string. Cette route
     reste silencieuse afin que le logger HTTP ne persiste jamais ce secret. */
  app.get("/api/whatsapp/webhook", { logLevel: "silent" }, async (request, reply) => {
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = request.query;
    if (mode === "subscribe" && token && token === config.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      return reply.type("text/plain").send(challenge);
    }
    return reply.code(403).send({ error: "Vérification refusée." });
  });

  app.post("/api/whatsapp/webhook", {
    config: { rawBody: true, rateLimit: { max: 240, timeWindow: "1 minute" } }
  }, async (request, reply) => {
    const mustVerify = config.isProduction || Boolean(config.WHATSAPP_APP_SECRET);
    if (mustVerify && !verifyMetaSignature(
      config.WHATSAPP_APP_SECRET,
      request.rawBody,
      request.headers["x-hub-signature-256"]
    )) {
      request.log.warn("Signature webhook Meta refusée");
      return reply.code(config.WHATSAPP_APP_SECRET ? 401 : 503)
        .send({ error: "Webhook WhatsApp non authentifié." });
    }
    const entries = request.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        (value.messages || []).forEach((m) => {
          request.log.info({ from: m.from, type: m.type, text: m.text?.body }, "WhatsApp — message entrant");
        });
        for (const s of value.statuses || []) {
          request.log.info({ id: s.id, status: s.status, to: s.recipient_id }, "WhatsApp — statut");
          await notify.recordStatus(s.id, s.status); // delivered / read / failed sur la file
        }
      }
    }
    return reply.code(200).send({ received: true });
  });

  app.get("/api/orders/:reference", async (request, reply) => {
    const parsed = trackingSchema.safeParse({ ...request.params, ...request.query });
    if (!parsed.success) return reply.code(400).send({ error: "Lien de suivi invalide." });
    const result = await db.query(
      `select * from orders where reference=$1 and tracking_token=$2 limit 1`,
      [parsed.data.reference, parsed.data.tracking]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: "Commande introuvable." });
    return { order: publicOrder(result.rows[0]) };
  });

  app.post("/api/payments/paydunya/ipn", async (request, reply) => {
    let data = request.body?.data;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch { data = null; }
    }
    if (!data?.invoice?.token || !paydunya.verifyCallbackHash(data.hash)) {
      request.log.warn("Rejected PayDunya callback");
      return reply.code(400).send({ error: "Notification invalide." });
    }

    // Confirm independently with PayDunya. The callback itself never decides payment state.
    const verified = await paydunya.confirmInvoice(data.invoice.token);
    if (!paydunya.verifyCallbackHash(verified.hash)) {
      return reply.code(400).send({ error: "Confirmation invalide." });
    }
    await syncPayment(db, verified, { notify, config });
    return reply.code(200).send({ received: true });
  });

  for (const route of ["return", "cancel"]) {
    app.get(`/api/payments/paydunya/${route}`, async (request, reply) => {
      const token = String(request.query.token || "");
      if (!token) return reply.redirect("/");
      try {
        const verified = await paydunya.confirmInvoice(token);
        if (paydunya.verifyCallbackHash(verified.hash)) await syncPayment(db, verified, { notify, config });
      } catch (error) {
        request.log.warn({ error }, "Unable to confirm PayDunya return immediately");
      }
      const result = await db.query(`select reference, tracking_token from orders where provider_token=$1 limit 1`, [token]);
      const order = result.rows[0];
      if (!order) return reply.redirect("/");
      const target = `/confirmation.html?reference=${encodeURIComponent(order.reference)}&tracking=${order.tracking_token}${route === "cancel" ? "&cancelled=1" : ""}`;
      return reply.redirect(target);
    });
  }
}

export async function syncPayment(db, provider, hooks = {}) {
  const invoice = provider.invoice || {};
  const status = String(invoice.status || "pending").toLowerCase();
  const mapped = status === "completed" ? "paid" : status === "failed" ? "failed" : status === "cancelled" ? "cancelled" : "pending";
  const orderStatus = mapped === "paid" ? "confirmed" : mapped === "cancelled" ? "cancelled" : "pending_payment";
  const paidAt = mapped === "paid" ? new Date() : null;
  const result = await db.query(
    `update orders set payment_status=$1, status=$2, receipt_url=$3, provider_response=$4,
      paid_at=coalesce(paid_at,$5) where provider_token=$6 returning *`,
    [mapped, orderStatus, invoice.receipt_url || null, provider, paidAt, invoice.token]
  );

  const order = result.rows[0];
  if (order && mapped === "paid") {
    /* WhatsApp automatique au client + au concierge — la file dédoublonne
       par référence : jamais deux messages pour un même paiement. */
    if (hooks.notify) {
      const orderTemplate = hooks.config?.WHATSAPP_TEMPLATE_ORDER ? {
        name: hooks.config.WHATSAPP_TEMPLATE_ORDER,
        parameters: [
          order.product_name,
          order.variant_name,
          order.reference,
          "Édition limitée",
          "Livraison à Abidjan"
        ]
      } : null;
      await hooks.notify.enqueue("order-paid", order.customer_phone, orderPaidMessage(order), order.reference, orderTemplate);
      const paidAlert = orderAlert(order);
      await hooks.notify.enqueue("order-paid-alert", hooks.config?.WHATSAPP_CONCIERGE_NUMBER, paidAlert, order.reference,
        hooks.config?.WHATSAPP_TEMPLATE_CONCIERGE_ALERT ? {
          name: hooks.config.WHATSAPP_TEMPLATE_CONCIERGE_ALERT,
          parameters: ["Commande payée", order.reference, paidAlert]
        } : null);
    }
  }
}
