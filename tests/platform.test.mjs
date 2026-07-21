import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadCatalog, resolveLineItem } from "../server/catalog.mjs";
import { createPayDunyaClient } from "../server/payments/paydunya.mjs";
import { checkoutSchema, createOrder, publicOrder } from "../server/services/orders.mjs";
import { syncPayment } from "../server/routes/storefront.mjs";
import { buildApp } from "../server/app.mjs";

const config = {
  NODE_ENV: "test", PORT: 3000, PUBLIC_SITE_URL: "http://localhost:3000",
  COOKIE_SECRET: "a".repeat(32), DATABASE_URL: "postgres://unused",
  PAYDUNYA_MODE: "test", PAYDUNYA_MASTER_KEY: "master-test-key",
  PAYDUNYA_PRIVATE_KEY: "private", PAYDUNYA_TOKEN: "token",
  WHATSAPP_NUMBER: "2250173891404", DELIVERY_ABIDJAN_FEE: 2000,
  isProduction: false, publicSiteUrl: "http://localhost:3000"
};

test("catalogue resolves a server-priced variant", async () => {
  const catalog = await loadCatalog();
  const line = resolveLineItem(catalog, "genesio", "deep-brown", 2);
  assert.equal(line.product.price, 20000);
  assert.equal(line.variant.name, "Deep Brown");
  assert.equal(line.subtotal, 40000);
  assert.throws(() => resolveLineItem(catalog, "genesio", "inconnu", 1));
  assert.throws(() => resolveLineItem(catalog, "genesio", "deep-brown", 4));
});

test("checkout validates Côte d'Ivoire contact and delivery address", () => {
  const base = { productId: "genesio", variantId: "deep-brown", quantity: 1, customerName: "Awa Kouassi", customerEmail: "awa@example.com", customerPhone: "0700000000", deliveryMethod: "pickup", paymentMethod: "wave" };
  assert.equal(checkoutSchema.parse(base).customerPhone, "0700000000");
  assert.equal(checkoutSchema.parse({ ...base, customerPhone: "+225 07 00 00 00 00" }).customerPhone, "2250700000000");
  assert.equal(checkoutSchema.safeParse({ ...base, deliveryMethod: "abidjan_delivery", deliveryAddress: "court" }).success, false);
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
  const result = publicOrder({ reference: "LK-1", status: "confirmed", payment_status: "paid", product_name: "Genesio", product_sku: "LK-00", variant_name: "Original", quantity: 1, total_amount: 20000, currency: "XOF", delivery_method: "pickup", created_at: new Date(), receipt_url: null, customer_email: "secret@example.com", provider_token: "secret" });
  assert.equal(result.product, "Genesio LK-00");
  assert.equal("customer_email" in result, false);
  assert.equal("provider_token" in result, false);
});

test("order creation persists server totals before creating the payment invoice", async () => {
  const catalog = await loadCatalog();
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("insert into orders")) return { rows: [{ id: "order-id", reference: params[0], tracking_token: params[1], status: "pending_payment", payment_status: "pending", payment_method: params[2], product_name: params[6], product_sku: params[5], variant_name: params[8], quantity: params[10], total_amount: params[13], currency: "XOF", delivery_method: params[11], created_at: new Date() }] };
      return { rows: [{ id: "order-id", reference: calls[0].params[0], tracking_token: calls[0].params[1], status: "pending_payment", payment_status: "pending", payment_method: "wave", product_name: "Genesio", product_sku: "LK-00", variant_name: "Original", quantity: 1, total_amount: 22000, currency: "XOF", delivery_method: "abidjan_delivery", created_at: new Date(), provider_token: "test_invoice" }] };
    }
  };
  const paydunya = { channelsFor: () => ["wave-ci"], createInvoice: async (payload) => { assert.equal(payload.invoice.total_amount, 22000); return { response_code: "00", response_text: "https://pay.test/invoice", token: "test_invoice" }; } };
  const result = await createOrder({ db, catalog, config, paydunya, input: { productId: "genesio", variantId: "deep-brown", quantity: 1, customerName: "Awa Kouassi", customerEmail: "awa@example.com", customerPhone: "+2250700000000", deliveryMethod: "abidjan_delivery", deliveryAddress: "Cocody Angré, Abidjan", paymentMethod: "wave" } });
  assert.equal(result.redirectUrl, "https://pay.test/invoice");
  assert.equal(calls[0].params[13], 22000);
  assert.match(calls[0].sql, /insert into orders/);
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
  assert.equal(catalogResponse.json().products.length, 7);
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
  assert.match(appResponse.body, /Réserver un essayage/);
  const badDate = await app.inject({ method: "GET", url: "/api/bookings/availability?date=pas-une-date" });
  assert.equal(badDate.statusCode, 400);
  const webhookDenied = await app.inject({ method: "GET", url: "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=faux&hub.challenge=x" });
  assert.equal(webhookDenied.statusCode, 403);
  const privateFile = await app.inject({ method: "GET", url: "/server/config.mjs" });
  assert.equal(privateFile.statusCode, 404);
  const callback = await app.inject({ method: "POST", url: "/api/payments/paydunya/ipn", headers: { "content-type": "application/x-www-form-urlencoded" }, payload: "data%5Bhash%5D=valid-hash&data%5Binvoice%5D%5Btoken%5D=test_invoice" });
  assert.equal(callback.statusCode, 200);
  assert.ok(dbCalls.some(([sql]) => sql.includes("update orders")));
  await app.close();
});
