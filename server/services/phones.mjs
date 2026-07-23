/**
 * Normalise un numéro WhatsApp vers le format E.164 sans le signe "+".
 *
 * Les numéros internationaux doivent inclure leur indicatif pays (+33, +1…).
 * Pour préserver le parcours historique en Côte d'Ivoire, un numéro local de
 * 10 chiffres reste automatiquement préfixé par 225.
 */
export function normalizeWhatsAppPhone(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  let normalized = digits;

  if (raw.startsWith("00")) normalized = digits.slice(2);
  else if (!raw.startsWith("+") && digits.length === 10) normalized = `225${digits}`;

  return /^[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}
