import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveLineItem } from "../catalog.mjs";

export const checkoutSchema = z.object({
  productId: z.string().min(1).max(40),
  variantId: z.string().min(1).max(40),
  quantity: z.coerce.number().int().min(1).max(2),
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.string().trim().email().max(200),
  customerPhone: z.string().trim().transform((value) => value.replace(/\D/g, ""))
    .refine((value) => /^(?:225)?\d{10}$/.test(value), "Numéro ivoirien invalide."),
  deliveryMethod: z.literal("abidjan_delivery"),
  deliveryAddress: z.string().trim().max(300).optional().default(""),
  customerNote: z.string().trim().max(500).optional().default(""),
  paymentMethod: z.enum(["wave", "mobile_money", "card", "all", "whatsapp_wave"])
}).superRefine((value, ctx) => {
  if (value.deliveryMethod === "abidjan_delivery" && value.deliveryAddress.length < 8) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deliveryAddress"], message: "Précisez l'adresse de livraison." });
  }
});

function cleanPhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("225") ? digits.slice(3) : digits;
}

function makeReference() {
  const date = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  return `LK-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function createOrder({ db, catalog, config, paydunya, input }) {
  const opensAt = new Date(config.ORDER_OPEN_AT || catalog.orderOpenAt).getTime();
  if (Number.isFinite(opensAt) && Date.now() < opensAt) {
    throw Object.assign(new Error("Les commandes ouvrent le 24.07.2026."), { statusCode: 425 });
  }
  const values = checkoutSchema.parse(input);
  const line = resolveLineItem(catalog, values.productId, values.variantId, values.quantity);

  const deliveryFee = values.deliveryMethod === "abidjan_delivery"
    && line.product.tier !== "exclusive"
    ? config.DELIVERY_ABIDJAN_FEE
    : 0;
  const totalAmount = line.subtotal + deliveryFee;
  const reference = makeReference();
  const trackingToken = randomUUID();
  const phone = cleanPhone(values.customerPhone);
  const manual = values.paymentMethod === "whatsapp_wave";

  if (!manual && !config.paydunyaConfigured) {
    throw Object.assign(
      new Error("Le paiement en ligne est momentanément indisponible. Choisissez la commande par WhatsApp."),
      { statusCode: 503 }
    );
  }

  const inserted = await db.query(
    `insert into orders (
      reference, tracking_token, payment_method, payment_provider,
      product_id, product_sku, product_name, variant_id, variant_name,
      unit_price, quantity, delivery_method, delivery_fee, total_amount,
      customer_name, customer_email, customer_phone, delivery_address, customer_note, edition_size
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
    returning *`,
    [
      reference, trackingToken, values.paymentMethod, manual ? "manual" : "paydunya",
      line.product.id, line.product.sku, line.product.name, line.variant.id, line.variant.name,
      line.product.price, line.quantity, values.deliveryMethod, deliveryFee, totalAmount,
      values.customerName, values.customerEmail, phone, values.deliveryAddress || null, values.customerNote || null,
      null
    ]
  );
  const order = inserted.rows[0];

  if (manual) {
    const message = [
      `Bonjour LEAKS, je souhaite payer ma commande ${reference} via Wave.`,
      `Article : ${line.product.name} ${line.product.sku} — ${line.variant.name}`,
      `Quantité : ${line.quantity}`,
      `Total : ${totalAmount.toLocaleString("fr-FR")} F CFA`,
      `Nom : ${values.customerName}`,
      `Téléphone : +225 ${phone}`
    ].join("\n");
    return {
      order,
      trackingToken,
      redirectUrl: `https://wa.me/${config.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
      manual: true
    };
  }

  const paymentPayload = {
    invoice: {
      items: {
        item_0: {
          name: `${line.product.name} ${line.product.sku} — ${line.variant.name}`,
          quantity: line.quantity,
          unit_price: line.product.price,
          total_price: line.subtotal,
          description: line.product.description
        }
      },
      taxes: deliveryFee ? { delivery: { name: "Livraison Abidjan", amount: deliveryFee } } : {},
      customer: { name: values.customerName, email: values.customerEmail, phone },
      channels: paydunya.channelsFor(values.paymentMethod),
      total_amount: totalAmount,
      description: `Commande LEAKS ${reference}`
    },
    store: {
      name: "LEAKS Sunglasses",
      tagline: "Modèles premium et édition limitée.",
      postal_address: "Abidjan, Côte d'Ivoire",
      phone: config.WHATSAPP_NUMBER,
      logo_url: `${config.publicSiteUrl}/assets/img/brand/logo-full.png`,
      website_url: config.publicSiteUrl
    },
    custom_data: { order_reference: reference },
    actions: {
      cancel_url: `${config.publicSiteUrl}/api/payments/paydunya/cancel`,
      return_url: `${config.publicSiteUrl}/api/payments/paydunya/return`,
      callback_url: `${config.publicSiteUrl}/api/payments/paydunya/ipn`
    }
  };

  try {
    const provider = await paydunya.createInvoice(paymentPayload);
    const updated = await db.query(
      `update orders set provider_token=$1, payment_url=$2, provider_response=$3 where id=$4 returning *`,
      [provider.token, provider.response_text, provider, order.id]
    );
    return { order: updated.rows[0], trackingToken, redirectUrl: provider.response_text, manual: false };
  } catch (error) {
    await db.query(
      `update orders set payment_status='manual_review', provider_response=$1 where id=$2`,
      [error.providerResponse || { message: error.message }, order.id]
    );
    throw error;
  }
}

export function publicOrder(order) {
  return {
    reference: order.reference,
    status: order.status,
    paymentStatus: order.payment_status,
    product: `${order.product_name} ${order.product_sku}`,
    variant: order.variant_name,
    quantity: order.quantity,
    totalAmount: order.total_amount,
    currency: order.currency,
    deliveryMethod: order.delivery_method,
    createdAt: order.created_at,
    receiptUrl: order.receipt_url
  };
}
