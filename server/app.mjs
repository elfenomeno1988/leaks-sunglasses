import path from "node:path";
import dns from "node:dns";
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
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { global: true, max: 120, timeWindow: "1 minute" });

  const auth = createAuth({ db, config });
  const whatsapp = overrides.whatsapp || createWhatsAppNotifier(config, app.log);
  const notify = overrides.notify || createNotificationCenter({ db, whatsapp, logger: app.log });
  await storefrontRoutes(app, { db, catalog, config, paydunya, whatsapp, notify });
  await adminRoutes(app, { db, auth, config, notify });
  notify.start();

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  await app.register(fastifyStatic, {
    root,
    wildcard: false,
    setHeaders(res, filePath) {
      /* Les images produits/campagne ne bougent jamais ; le code un peu. */
      if (/[\\/]assets[\\/]/.test(filePath)) res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      else if (/\.(css|js)$/.test(filePath)) res.setHeader("Cache-Control", "public, max-age=3600");
      else res.setHeader("Cache-Control", "no-cache");
    },
    allowedPath(pathName) {
      return pathName === "/" || pathName === "/index.html" || pathName === "/gallery.html" || pathName === "/checkout.html" || pathName === "/confirmation.html" ||
        pathName === "/admin.html" || pathName === "/campagne.html" || pathName === "/manifeste.html" ||
        pathName === "/m.html" || pathName === "/manifest.webmanifest" ||
        pathName.startsWith("/assets/") || pathName.startsWith("/css/") || pathName.startsWith("/js/");
    }
  });

  for (const page of ["gallery", "checkout", "confirmation", "admin", "campagne", "manifeste", "m"]) {
    app.get(`/${page}`, async (_request, reply) => reply.redirect(`/${page}.html`));
  }
  app.get("/health", async () => {
    await db.query("select 1");
    return { ok: true };
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
}
