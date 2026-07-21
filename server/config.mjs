import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  COOKIE_SECRET: z.string().min(32),
  PAYDUNYA_MODE: z.enum(["test", "live"]).default("test"),
  PAYDUNYA_MASTER_KEY: z.string().min(1),
  PAYDUNYA_PRIVATE_KEY: z.string().min(1),
  PAYDUNYA_TOKEN: z.string().min(1),
  WHATSAPP_NUMBER: z.string().regex(/^\d{8,15}$/).default("2250173891404"),
  DELIVERY_ABIDJAN_FEE: z.coerce.number().int().nonnegative().default(2000),

  /* WhatsApp Business (Cloud API, Meta) — l'envoi automatique des messages.
     Laisser vide tant que le compte n'est pas approuvé : l'app fonctionne
     alors en remise « wa.me » (le client envoie lui-même sa carte). */
  WHATSAPP_CLOUD_TOKEN: z.string().optional().default(""),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(""),
  WHATSAPP_CONCIERGE_NUMBER: z.string().regex(/^\d{8,15}$/).optional().default("2250173891404"),

  /* Hors fenêtre de 24 h, Meta n'accepte que des templates approuvés.
     Nom du template de confirmation (variables : date, heure, référence). */
  WHATSAPP_TEMPLATE_BOOKING: z.string().optional().default(""),
  WHATSAPP_TEMPLATE_LANG: z.string().optional().default("fr"),

  /* Jeton de vérification du webhook (choisi par nous, recopié chez Meta). */
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional().default("")
});

export function loadConfig(env = process.env) {
  const result = schema.safeParse(env);
  if (!result.success) {
    const message = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Configuration invalide:\n${message}`);
  }

  const config = result.data;
  return {
    ...config,
    isProduction: config.NODE_ENV === "production",
    publicSiteUrl: config.PUBLIC_SITE_URL.replace(/\/$/, "")
  };
}
