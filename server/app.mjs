import path from "node:path";
import dns from "node:dns";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/* Sur certains réseaux (macOS notamment), Node préfère l'IPv6 et échoue à
   joindre graph.facebook.com — l'IPv4 d'abord règle l'envoi WhatsApp. */
dns.setDefaultResultOrder("ipv4first");
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import rawBody from "fastify-raw-body";
import qs from "qs";
import { ZodError } from "zod";
import { loadConfig } from "./config.mjs";
import { createDatabase } from "./db.mjs";
import { loadCatalog } from "./catalog.mjs";
import { createPayDunyaClient } from "./payments/paydunya.mjs";
import { createAuth } from "./auth.mjs";
import { createWhatsAppNotifier } from "./services/whatsapp.mjs";
import { createNotificationCenter } from "./services/notifications.mjs";
import { storefrontRoutes } from "./routes/storefront.mjs";
import { adminRoutes } from "./routes/admin.mjs";

export async function buildApp(overrides = {}) {
  const config = overrides.config || loadConfig();
  const db = overrides.db || createDatabase(config);
  const catalog = overrides.catalog || await loadCatalog();
  const paydunya = overrides.paydunya || createPayDunyaClient(config);
  const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 100_000 });

  await app.register(cookie, { secret: config.COOKIE_SECRET, hook: "onRequest" });
  await app.register(formbody, { parser: (body) => qs.parse(body, { depth: 8, parameterLimit: 200 }) });
  await app.register(rawBody, { field: "rawBody", global: false, encoding: "utf8", runFirst: true });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { global: true, max: 120, timeWindow: "1 minute" });

  const auth = createAuth({ db, config });
  const whatsapp = overrides.whatsapp || createWhatsAppNotifier(config, app.log);
  const notify = overrides.notify || createNotificationCenter({ db, whatsapp, config, logger: app.log });
  await storefrontRoutes(app, { db, catalog, config, paydunya, whatsapp, notify });
  await adminRoutes(app, { db, auth, config, notify });
  notify.start();

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  await app.register(fastifyStatic, {
    root,
    wildcard: false,
    cacheControl: false, // sinon le plugin écrase nos Cache-Control
    setHeaders(res, filePath) {
      /* Les images produits/campagne ne bougent jamais ; le code est
         versionné par ?v=N dans les pages. En dev : jamais de cache,
         chaque changement s'affiche immédiatement.
         (@fastify/static passe tantôt la réponse brute, tantôt un Reply.) */
      const raw = typeof res.setHeader === "function" ? res : res.raw;
      if (!config.isProduction) raw.setHeader("Cache-Control", "no-store");
      else if (/[\\/]assets[\\/]/.test(filePath)) raw.setHeader("Cache-Control", "public, max-age=604800, immutable");
      else if (/\.(css|js)$/.test(filePath)) raw.setHeader("Cache-Control", "public, max-age=86400");
      else raw.setHeader("Cache-Control", "no-cache");
    },
    allowedPath(pathName) {
      return pathName === "/" || pathName === "/index.html" || pathName === "/gallery.html" || pathName === "/checkout.html" || pathName === "/confirmation.html" ||
        pathName === "/admin.html" || pathName === "/campagne.html" || pathName === "/manifeste.html" ||
        pathName === "/m.html" || pathName === "/manifest.webmanifest" || pathName === "/legal.html" || pathName === "/privacy.html" || pathName === "/404.html" ||
        pathName.startsWith("/assets/") || pathName.startsWith("/css/") || pathName.startsWith("/js/");
    }
  });

  for (const page of ["gallery", "checkout", "confirmation", "admin", "campagne", "manifeste", "m", "legal", "privacy"]) {
    app.get(`/${page}`, async (_request, reply) => reply.redirect(`/${page}.html`));
  }

  /* ── SEO : robots + sitemap, construits sur l'URL publique ──── */

  app.get("/robots.txt", async (_request, reply) => {
    return reply.type("text/plain").send([
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin.html",
      "Disallow: /api/",
      "",
      `Sitemap: ${config.publicSiteUrl}/sitemap.xml`
    ].join("\n"));
  });

  app.get("/sitemap.xml", async (_request, reply) => {
    const pages = [
      "/", "/campagne.html", "/manifeste.html", "/legal.html", "/privacy.html",
      ...catalog.list.map((p) => `/gallery.html?product=${p.id}`)
    ];
    const urls = pages.map((p) =>
      `  <url><loc>${config.publicSiteUrl}${p.replaceAll("&", "&amp;")}</loc></url>`).join("\n");
    return reply.type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
    );
  });
  app.get("/health", async () => {
    await db.query("select 1");
    /* Profondeur de la file WhatsApp — pour la supervision. */
    let notifications = null;
    try {
      const r = await db.query(
        `select count(*) filter (where status = 'queued')::int as queued,
                count(*) filter (where status = 'failed')::int as failed
         from notifications`
      );
      notifications = r.rows[0] || null;
    } catch { /* table absente (première migration à venir) */ }
    return {
      ok: true,
      notifications,
      capabilities: {
        paydunya: Boolean(config.paydunyaConfigured),
        whatsappCloud: Boolean(whatsapp.enabled),
        whatsappTemplates: Boolean(
          config.WHATSAPP_TEMPLATE_BOOKING &&
          config.WHATSAPP_TEMPLATE_ORDER &&
          config.WHATSAPP_TEMPLATE_BOOKING_UPDATE &&
          config.WHATSAPP_TEMPLATE_ORDER_UPDATE &&
          config.WHATSAPP_TEMPLATE_CONCIERGE_ALERT
        ),
        whatsappWebhookSigned: Boolean(config.WHATSAPP_APP_SECRET),
        whatsappHandoff: true
      }
    };
  });

  /* ── 404 : JSON pour l'API, page habillée pour le reste ─────── */
  const notFoundHtml = await readFile(path.join(root, "404.html"), "utf8").catch(() => "Page introuvable.");
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "Ressource introuvable." });
    }
    return reply.code(404).type("text/html; charset=utf-8").send(notFoundHtml);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: "Certains champs sont invalides.", fields: error.flatten().fieldErrors });
    }
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    return reply.code(status).send({ error: status === 500 ? "Une erreur interne est survenue." : error.message });
  });

  app.addHook("onClose", async () => {
    notify.stop();
    if (!overrides.db) await db.end();
  });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  const app = await buildApp({ config });
  await app.listen({ host: "0.0.0.0", port: config.PORT });

  /* Arrêt propre : docker stop / systemd envoient SIGTERM — on finit les
     requêtes en cours, on arrête la file, on ferme la base, puis on sort. */
  let stopping = false;
  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    app.log.info({ signal }, "Arrêt propre demandé");
    try { await app.close(); } finally { process.exit(0); }
  };
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => shutdown(signal));

  process.on("unhandledRejection", (reason) => app.log.error({ reason: String(reason) }, "Promesse rejetée non gérée"));
  process.on("uncaughtException", (error) => {
    app.log.fatal({ error: String(error?.stack || error) }, "Exception non rattrapée — arrêt");
    shutdown("uncaughtException");
  });
}
