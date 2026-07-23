import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { loadCatalog, resolveLineItem } from "../server/catalog.mjs";
import { createPayDunyaClient } from "../server/payments/paydunya.mjs";
import { checkoutSchema, createOrder, publicOrder } from "../server/services/orders.mjs";
import { bookingWhatsAppDelivery, syncPayment, verifyMetaSignature } from "../server/routes/storefront.mjs";
import { buildApp } from "../server/app.mjs";
import { createNotificationCenter } from "../server/services/notifications.mjs";
import { loadConfig } from "../server/config.mjs";
import { bookingUpdateTemplateParameters, createWhatsAppNotifier, orderStatusTemplateParameters } from "../server/services/whatsapp.mjs";

const config = {
  NODE_ENV: "test", PORT: 3000, PUBLIC_SITE_URL: "http://localhost:3000",
  COOKIE_SECRET: "a".repeat(32), DATABASE_URL: "postgres://unused",
  PAYDUNYA_MODE: "test", PAYDUNYA_MASTER_KEY: "master-test-key",
  PAYDUNYA_PRIVATE_KEY: "private", PAYDUNYA_TOKEN: "token",
  paydunyaConfigured: true,
  WHATSAPP_NUMBER: "2250173891404", DELIVERY_ABIDJAN_FEE: 1000,
  ORDER_OPEN_AT: "2020-01-01T00:00:00Z",
  META_GRAPH_VERSION: "v25.0",
  WHATSAPP_TEMPLATE_BOOKING: "leaks_confirmation_rdv",
  WHATSAPP_TEMPLATE_ORDER: "leaks_confirmation_commande",
  WHATSAPP_TEMPLATE_BOOKING_UPDATE: "leaks_suivi_rdv",
  WHATSAPP_TEMPLATE_ORDER_UPDATE: "leaks_suivi_commande",
  WHATSAPP_TEMPLATE_CONCIERGE_ALERT: "leaks_alerte_concierge",
  WHATSAPP_APP_SECRET: "meta-app-secret",
  isProduction: false, publicSiteUrl: "http://localhost:3000"
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("catalogue resolves a server-priced variant", async () => {
  const catalog = await loadCatalog();
  const line = resolveLineItem(catalog, "genesio", "deep-brown", 2);
  assert.equal(line.product.price, 24900);
  assert.equal(line.variant.name, "Deep Brown");
  assert.equal(line.editionSize, 2);
  assert.equal(line.subtotal, 49800);
  assert.throws(() => resolveLineItem(catalog, "genesio", "inconnu", 1));
  assert.throws(() => resolveLineItem(catalog, "genesio", "deep-brown", 3));
  assert.throws(() => resolveLineItem(catalog, "genesio", "deep-brown", 4));
});

test("browser and server catalogues stay aligned and reference real assets", async () => {
  const serverCatalog = await loadCatalog();
  const source = await readFile(path.join(projectRoot, "js/catalog-data.js"), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: "js/catalog-data.js" });

  const browserProducts = [
    ...context.window.LEAKS_MODELS.map((model) => ({
      id: model.id, sku: model.sku, name: model.name, tier: model.tier,
      price: model.price,
      variants: model.colors.map((variant) => ({ id: variant.variantId, name: variant.label, image: variant.image })),
      images: model.colors.flatMap((variant) => variant.views.map((view) => view.src))
    })),
    ...context.window.LEAKS_ACCESSORIES.map((item) => ({
      id: item.id, sku: item.sku, name: item.name, tier: "accessory",
      price: item.price,
      variants: [{ id: item.variantId, name: item.variantLabel, image: item.image }],
      images: item.image ? [item.image] : []
    }))
  ];

  assert.equal(browserProducts.length, serverCatalog.list.length);
  for (const browserProduct of browserProducts) {
    const serverProduct = serverCatalog.products.get(browserProduct.id);
    assert.ok(serverProduct, `produit serveur absent : ${browserProduct.id}`);
    assert.deepEqual(
      { sku: browserProduct.sku, name: browserProduct.name, tier: browserProduct.tier, price: browserProduct.price },
      { sku: serverProduct.sku, name: serverProduct.name, tier: serverProduct.tier, price: serverProduct.price }
    );
    assert.equal(
      JSON.stringify(browserProduct.variants.map(({ id, name }) => ({ id, name }))),
      JSON.stringify(serverProduct.variants.map(({ id, name }) => ({ id, name })))
    );
    for (const image of [...browserProduct.images, ...serverProduct.variants.map((variant) => variant.image)].filter(Boolean)) {
      await access(path.join(projectRoot, image.replace(/^\//, "")));
    }
  }
});

test("checkout validates Côte d'Ivoire contact and delivery address", () => {
  const base = { productId: "genesio", variantId: "deep-brown", quantity: 1, customerName: "Awa Kouassi", customerEmail: "awa@example.com", customerPhone: "0700000000", deliveryMethod: "abidjan_delivery", deliveryAddress: "Cocody Angré, Abidjan", paymentMethod: "wave" };
  assert.equal(checkoutSchema.parse(base).customerPhone, "2250700000000");
  assert.equal(checkoutSchema.parse({ ...base, customerPhone: "+225 07 00 00 00 00" }).customerPhone, "2250700000000");
  assert.equal(checkoutSchema.safeParse({ ...base, deliveryMethod: "abidjan_delivery", deliveryAddress: "court" }).success, false);
});

test("orders cannot be created before the announced opening", async () => {
  const catalog = await loadCatalog();
  const db = { query: async () => { throw new Error("database should not be called"); } };
  await assert.rejects(
    createOrder({
      db, catalog,
      config: { ...config, ORDER_OPEN_AT: "2099-01-01T00:00:00Z" },
      paydunya: {},
      input: {
        productId: "genesio", variantId: "deep-brown", quantity: 1,
        customerName: "Awa Kouassi", customerEmail: "awa@example.com",
        customerPhone: "0700000000", deliveryMethod: "abidjan_delivery",
        deliveryAddress: "Cocody Angré, Abidjan", paymentMethod: "whatsapp_wave"
      }
    }),
    (error) => error.statusCode === 425 && /24.07.2026/.test(error.message)
  );
});

test("online payment is refused before creating an order when PayDunya is not configured", async () => {
  const catalog = await loadCatalog();
  const calls = [];
  const db = { query: async (...args) => { calls.push(args); return { rows: [{ sold: 0, reserved: 0 }] }; } };
  await assert.rejects(
    createOrder({
      db,
      catalog,
      config: { ...config, paydunyaConfigured: false },
      paydunya: {},
      input: {
        productId: "genesio", variantId: "deep-brown", quantity: 1,
        customerName: "Awa Kouassi", customerEmail: "awa@example.com",
        customerPhone: "0700000000", deliveryMethod: "abidjan_delivery",
        deliveryAddress: "Cocody Angré, Abidjan", paymentMethod: "wave"
      }
    }),
    (error) => error.statusCode === 503 && /WhatsApp/.test(error.message)
  );
  assert.equal(calls.some(([sql]) => /insert into orders/.test(sql)), false);
});

test("production never exposes PayDunya sandbox checkout", () => {
  const baseEnv = {
    DATABASE_URL: "postgres://unused",
    COOKIE_SECRET: "x".repeat(32),
    PAYDUNYA_MASTER_KEY: "master",
    PAYDUNYA_PRIVATE_KEY: "private",
    PAYDUNYA_TOKEN: "token"
  };
  assert.equal(loadConfig({ ...baseEnv, NODE_ENV: "production", PAYDUNYA_MODE: "test" }).paydunyaConfigured, false);
  assert.equal(loadConfig({ ...baseEnv, NODE_ENV: "production", PAYDUNYA_MODE: "live" }).paydunyaConfigured, true);
  assert.equal(loadConfig({ ...baseEnv }).META_GRAPH_VERSION, "v25.0");
});

test("PayDunya channels and callback hash are restricted correctly", () => {
  const client = createPayDunyaClient(config);
  assert.deepEqual(client.channelsFor("wave"), ["wave-ci"]);
  assert.ok(client.channelsFor("all").includes("djamo-ci"));
  const hash = createHash("sha512").update(config.PAYDUNYA_MASTER_KEY).digest("hex");
  assert.equal(client.verifyCallbackHash(hash), true);
  assert.equal(client.verifyCallbackHash("bad"), false);
});

test("payment synchronization trusts independently confirmed provider data", async () => {
  const calls = [];
  const db = { query: async (...args) => { calls.push(args); return { rows: [] }; } };
  await syncPayment(db, { invoice: { token: "test_123", status: "completed", receipt_url: "https://receipt.test" } });
  assert.match(calls[0][0], /update orders/);
  assert.equal(calls[0][1][0], "paid");
  assert.equal(calls[0][1][1], "confirmed");
});

test("public order response does not expose customer or provider secrets", () => {
  const result = publicOrder({ reference: "LK-1", status: "confirmed", payment_status: "paid", product_name: "Genesio", product_sku: "LK-00", variant_name: "Original", quantity: 1, total_amount: 20000, currency: "XOF", delivery_method: "abidjan_delivery", created_at: new Date(), receipt_url: null, customer_email: "secret@example.com", provider_token: "secret" });
  assert.equal(result.product, "Genesio LK-00");
  assert.equal("customer_email" in result, false);
  assert.equal("provider_token" in result, false);
});

test("notification queue stores approved Meta template data", async () => {
  const calls = [];
  const db = { query: async (...args) => { calls.push(args); return { rows: [] }; } };
  const center = createNotificationCenter({
    db,
    whatsapp: { enabled: false },
    logger: { warn() {}, error() {} }
  });
  await center.enqueue("order-paid", " +225 07 00 00 00 00 ", "Commande confirmée", "LK-TEST", {
    name: "leaks_confirmation_commande",
    parameters: ["LUNETTES 01", "Noir", "LK-TEST", "Édition limitée", "Livraison à Abidjan"]
  });
  assert.match(calls[0][0], /template_name/);
  assert.equal(calls[0][1][1], "2250700000000");
  assert.equal(calls[0][1][4], "leaks_confirmation_commande");
  assert.deepEqual(JSON.parse(calls[0][1][5]), ["LUNETTES 01", "Noir", "LK-TEST", "Édition limitée", "Livraison à Abidjan"]);
});

test("booking response distinguishes automatic queue from WhatsApp handoff", () => {
  assert.equal(bookingWhatsAppDelivery(true), "queued");
  assert.equal(bookingWhatsAppDelivery(false), "handoff");
});

test("all delayed WhatsApp updates have approved-template payloads", () => {
  const booking = { date: "2026-07-23", time: "14:00", reference: "RDV-LEAKS-1234" };
  const appointment = bookingUpdateTemplateParameters("Confirmé", booking, "Votre concierge vous attend.");
  assert.equal(appointment.length, 5);
  assert.equal(appointment[3], booking.reference);

  const order = { product_name: "Genesio", variant_name: "Deep Brown", reference: "LK-LEAKS-1234" };
  const update = orderStatusTemplateParameters("shipped", order);
  assert.deepEqual(update.slice(0, 4), ["En route", "Genesio", "Deep Brown", "LK-LEAKS-1234"]);
});

test("WhatsApp Cloud uses the configured Graph version and template payload", async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  try {
    const whatsapp = createWhatsAppNotifier({
      ...config,
      WHATSAPP_CLOUD_TOKEN: "server-token",
      WHATSAPP_PHONE_NUMBER_ID: "1239914522534675",
      WHATSAPP_TEMPLATE_LANG: "fr"
    });
    await whatsapp.sendTemplate("2250173891404", "leaks_confirmation_rdv", ["Jeudi 23 juillet", "15:00", "LK-RDV-TEST"]);
    assert.match(request.url, /graph\.facebook\.com\/v25\.0\/1239914522534675\/messages$/);
    assert.equal(request.options.headers.Authorization, "Bearer server-token");
    const payload = JSON.parse(request.options.body);
    assert.equal(payload.template.name, "leaks_confirmation_rdv");
    assert.equal(payload.template.language.code, "fr");
    assert.equal(payload.template.components[0].parameters.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("WhatsApp automation activates only after Meta approves the French template", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    assert.match(String(url), /v25\.0\/821478214384181\/message_templates/);
    return new Response(JSON.stringify({
      data: [{ name: "leaks_confirmation_rdv", status: "APPROVED", language: "fr" }]
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const whatsapp = createWhatsAppNotifier({
      ...config,
      WHATSAPP_CLOUD_TOKEN: "server-token",
      WHATSAPP_PHONE_NUMBER_ID: "1239914522534675",
      WHATSAPP_BUSINESS_ACCOUNT_ID: "821478214384181",
      WHATSAPP_TEMPLATE_LANG: "fr"
    });
    assert.equal(await whatsapp.isTemplateApproved("leaks_confirmation_rdv"), true);
    assert.equal(await whatsapp.isTemplateApproved("leaks_confirmation_rdv"), true);
    assert.equal(calls, 1, "le statut approuvé doit être mis en cache");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Meta webhook signatures are verified before processing", () => {
  const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const secret = "meta-app-secret";
  const signature = `sha256=${createHash("sha256").update("").digest("hex")}`;
  assert.equal(verifyMetaSignature(secret, raw, signature), false);
  const valid = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  assert.equal(verifyMetaSignature(secret, raw, valid), true);
});

test("order creation persists server totals and edition stock before creating the payment invoice", async () => {
  const catalog = await loadCatalog();
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("insert into orders")) return { rows: [{ id: "order-id", reference: params[0], tracking_token: params[1], status: "pending_payment", payment_status: "pending", payment_method: params[2], product_name: params[6], product_sku: params[5], variant_name: params[8], quantity: params[10], total_amount: params[13], currency: "XOF", delivery_method: params[11], created_at: new Date() }] };
      const insertCall = calls.find((call) => call.sql.includes("insert into orders"));
      return { rows: [{ id: "order-id", reference: insertCall.params[0], tracking_token: insertCall.params[1], status: "pending_payment", payment_status: "pending", payment_method: "wave", product_name: "Genesio", product_sku: "LK-00", variant_name: "Deep Brown", quantity: 1, total_amount: 25900, currency: "XOF", delivery_method: "abidjan_delivery", created_at: new Date(), provider_token: "test_invoice" }] };
    }
  };
  const paydunya = { channelsFor: () => ["wave-ci"], createInvoice: async (payload) => { assert.equal(payload.invoice.total_amount, 25900); return { response_code: "00", response_text: "https://pay.test/invoice", token: "test_invoice" }; } };
  const result = await createOrder({ db, catalog, config, paydunya, input: { productId: "genesio", variantId: "deep-brown", quantity: 1, customerName: "Awa Kouassi", customerEmail: "awa@example.com", customerPhone: "+2250700000000", deliveryMethod: "abidjan_delivery", deliveryAddress: "Cocody Angré, Abidjan", paymentMethod: "wave" } });
  assert.equal(result.redirectUrl, "https://pay.test/invoice");
  const insertCall = calls.find((call) => call.sql.includes("insert into orders"));
  assert.ok(insertCall, "insert into orders attendu");
  assert.equal(insertCall.params[13], 25900);
  assert.equal(insertCall.params[19], 2);
});

test("a sold-out color cannot create another order", async () => {
  const catalog = await loadCatalog();
  const db = {
    async query(sql) {
      assert.match(sql, /inventory_lock/);
      return { rows: [] };
    }
  };
  await assert.rejects(
    createOrder({
      db, catalog, config, paydunya: {},
      input: {
        productId: "genesio", variantId: "deep-brown", quantity: 1,
        customerName: "Awa Kouassi", customerEmail: "awa@example.com",
        customerPhone: "0700000000", deliveryMethod: "abidjan_delivery",
        deliveryAddress: "Cocody Angré, Abidjan", paymentMethod: "whatsapp_wave"
      }
    }),
    (error) => error.statusCode === 409 && /épuisé/.test(error.message)
  );
});

test("LEAKS Exclusive delivery in Abidjan is free", async () => {
  const catalog = await loadCatalog();
  let insertParams;
  const db = {
    async query(sql, params) {
      if (sql.includes("insert into orders")) {
        insertParams = params;
        return { rows: [{ id: "order-id", reference: params[0], tracking_token: params[1], total_amount: params[13] }] };
      }
      return { rows: [] };
    }
  };
  const result = await createOrder({
    db, catalog, config, paydunya: {},
    input: {
      productId: "marco", variantId: "brown-green", quantity: 1,
      customerName: "Awa Kouassi", customerEmail: "awa@example.com",
      customerPhone: "+2250700000000", deliveryMethod: "abidjan_delivery",
      deliveryAddress: "Cocody Angré, Abidjan", paymentMethod: "whatsapp_wave"
    }
  });
  assert.equal(insertParams[12], 0);
  assert.equal(insertParams[13], 29900);
  assert.equal(result.manual, true);
});

test("Fastify serves commerce pages and the public catalogue", async () => {
  const catalog = await loadCatalog();
  const dbCalls = [];
  const db = { query: async (...args) => { dbCalls.push(args); return { rows: [{ total: 0 }] }; } };
  const paydunya = {
    channelsFor: () => ["wave-ci"],
    verifyCallbackHash: (hash) => hash === "valid-hash",
    confirmInvoice: async (token) => ({ hash: "valid-hash", invoice: { token, status: "completed", receipt_url: "https://receipt.test" } })
  };
  const app = await buildApp({ config, db, catalog, paydunya });
  const catalogResponse = await app.inject({ method: "GET", url: "/api/catalog" });
  assert.equal(catalogResponse.statusCode, 200);
  assert.equal(catalogResponse.json().products.length, 14);
  assert.equal(catalogResponse.json().maxOrderQuantity, 2);
  assert.equal(catalogResponse.json().defaultEditionSize, 2);
  assert.equal(catalogResponse.json().editionLabel, "1 à 2 exemplaires par coloris");
  assert.equal(catalogResponse.json().products[0].variants[0].remaining, 2);
  assert.equal(catalogResponse.json().orderOpenAt, "2020-01-01T00:00:00Z");
  assert.deepEqual(catalogResponse.json().freeDeliveryTiers, ["exclusive"]);
  assert.equal(catalogResponse.json().deliveryFees.abidjan_delivery, 1000);
  assert.deepEqual(catalogResponse.json().paymentMethods, ["wave", "mobile_money", "card", "whatsapp_wave"]);
  const galleryRedirect = await app.inject({ method: "GET", url: "/gallery" });
  assert.equal(galleryRedirect.statusCode, 302);
  assert.equal(galleryRedirect.headers.location, "/gallery.html");
  const galleryResponse = await app.inject({ method: "GET", url: "/gallery.html?product=marco&variant=olive" });
  assert.equal(galleryResponse.statusCode, 200);
  assert.match(galleryResponse.body, /Un modèle, plusieurs coloris/);
  const checkoutResponse = await app.inject({ method: "GET", url: "/checkout.html" });
  assert.equal(checkoutResponse.statusCode, 200);
  assert.match(checkoutResponse.body, /La paire,/);
  const homeResponse = await app.inject({ method: "GET", url: "/" });
  assert.equal(homeResponse.statusCode, 200);
  assert.match(homeResponse.body, /LEAKS Sunglasses/);
  const appResponse = await app.inject({ method: "GET", url: "/m.html" });
  assert.equal(appResponse.statusCode, 200);
  assert.match(appResponse.body, /Réserver mon essayage/);
  const privacyResponse = await app.inject({ method: "GET", url: "/privacy.html" });
  assert.equal(privacyResponse.statusCode, 200);
  assert.match(privacyResponse.body, /Politique de confidentialité/);
  const badDate = await app.inject({ method: "GET", url: "/api/bookings/availability?date=pas-une-date" });
  assert.equal(badDate.statusCode, 400);
  const webhookDenied = await app.inject({ method: "GET", url: "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=faux&hub.challenge=x" });
  assert.equal(webhookDenied.statusCode, 403);
  const webhookPayload = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const unsignedWebhook = await app.inject({ method: "POST", url: "/api/whatsapp/webhook", payload: webhookPayload, headers: { "content-type": "application/json" } });
  assert.equal(unsignedWebhook.statusCode, 401);
  const webhookSignature = `sha256=${createHmac("sha256", config.WHATSAPP_APP_SECRET).update(webhookPayload).digest("hex")}`;
  const signedWebhook = await app.inject({ method: "POST", url: "/api/whatsapp/webhook", payload: webhookPayload, headers: { "content-type": "application/json", "x-hub-signature-256": webhookSignature } });
  assert.equal(signedWebhook.statusCode, 200);
  const health = await app.inject({ method: "GET", url: "/health" });
  assert.equal(health.json().capabilities.paydunya, true);
  assert.equal(health.json().capabilities.whatsappTemplates, true);
  assert.equal(health.json().capabilities.whatsappWebhookSigned, true);
  const privateFile = await app.inject({ method: "GET", url: "/server/config.mjs" });
  assert.equal(privateFile.statusCode, 404);
  const callback = await app.inject({ method: "POST", url: "/api/payments/paydunya/ipn", headers: { "content-type": "application/x-www-form-urlencoded" }, payload: "data%5Bhash%5D=valid-hash&data%5Binvoice%5D%5Btoken%5D=test_invoice" });
  assert.equal(callback.statusCode, 200);
  assert.ok(dbCalls.some(([sql]) => sql.includes("update orders")));
  await app.close();
});
