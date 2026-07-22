import { z } from "zod";
import { createOrder, publicOrder } from "../services/orders.mjs";
import { createBooking, bookedSlots, publicBooking } from "../services/bookings.mjs";
import { handoffMessage, customerMessage, conciergeAlert, orderPaidMessage, orderAlert } from "../services/whatsapp.mjs";

const trackingSchema = z.object({
  reference: z.string().min(8).max(40),
  tracking: z.string().uuid()
});

export async function storefrontRoutes(app, deps) {
  const { db, catalog, config, paydunya, whatsapp, notify } = deps;

  app.get("/api/catalog", async () => {
    /* Restant par coloris — les payées décomptent l'édition. */
    let sold = new Map();
    try {
      const r = await db.query(
        `select product_id, variant_id, coalesce(sum(quantity), 0)::int as sold
         from orders where payment_status = 'paid' and status <> 'cancelled'
         group by product_id, variant_id`
      );
      sold = new Map(r.rows.map((x) => [`${x.product_id}:${x.variant_id}`, Number(x.sold)]));
    } catch { /* base indisponible : on sert le catalogue sans stock */ }

    const products = catalog.list.map((p) => ({
      ...p,
      variants: p.variants.map((v) => ({
        ...v,
        remaining: p.editionSize
          ? Math.max(0, p.editionSize - (sold.get(`${p.id}:${v.id}`) || 0))
          : null
      }))
    }));

    return {
      currency: catalog.currency,
      deliveryFees: { pickup: 0, abidjan_delivery: config.DELIVERY_ABIDJAN_FEE },
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
      note: row.customer_note || ""
    };
    /* La confirmation et l'alerte passent par la file : envoi immédiat,
       reprises automatiques, jamais deux fois (dédoublonnage par référence). */
    await notify.enqueue("booking-confirmation", booking.phone, customerMessage(booking), booking.reference);
    await notify.enqueue("booking-alert", config.WHATSAPP_CONCIERGE_NUMBER, conciergeAlert(booking), booking.reference);
    return reply.code(201).send({
      booking: publicBooking(row),
      whatsapp: {
        delivery: whatsapp.enabled ? "sent" : "handoff", // file ≈ envoyé (quelques secondes)
        conciergeNumber: config.WHATSAPP_NUMBER,
        handoffText: handoffMessage(booking)             // la carte, déjà écrite
      }
    });
  });

  /* ── Webhook WhatsApp Cloud (vérification + accusés + réponses) ── */

  app.get("/api/whatsapp/webhook", async (request, reply) => {
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = request.query;
    if (mode === "subscribe" && token && token === config.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      return reply.type("text/plain").send(challenge);
    }
    return reply.code(403).send({ error: "Vérification refusée." });
  });

  app.post("/api/whatsapp/webhook", async (request, reply) => {
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
    /* Numéro de série : attribué une seule fois, au paiement. L'index
       unique (produit, coloris, numéro) tranche les courses — on retente. */
    if (order.serial_number == null) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          const s = await db.query(
            `update orders set serial_number = (
               select coalesce(max(serial_number), 0) + 1 from orders
               where product_id = $2 and variant_id = $3 and serial_number is not null)
             where id = $1 and serial_number is null
             returning serial_number`,
            [order.id, order.product_id, order.variant_id]
          );
          order.serial_number = s.rows[0]?.serial_number ?? order.serial_number;
          break;
        } catch (error) {
          if (error?.code !== "23505") break; // seule la collision d'index se rejoue
        }
      }
    }

    /* WhatsApp automatique au client + au concierge — la file dédoublonne
       par référence : jamais deux messages pour un même paiement. */
    if (hooks.notify) {
      await hooks.notify.enqueue("order-paid", order.customer_phone, orderPaidMessage(order), order.reference);
      await hooks.notify.enqueue("order-paid-alert", hooks.config?.WHATSAPP_CONCIERGE_NUMBER, orderAlert(order), order.reference);
    }
  }
}
