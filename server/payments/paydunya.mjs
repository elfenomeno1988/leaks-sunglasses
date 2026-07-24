import { createHash, timingSafeEqual } from "node:crypto";

const CHANNELS = {
  wave: ["wave-ci"],
  mobile_money: ["orange-money-ci", "mtn-ci", "moov-ci", "djamo-ci"],
  card: ["card"],
  all: ["wave-ci", "orange-money-ci", "mtn-ci", "moov-ci", "djamo-ci", "card"]
};

export function createPayDunyaClient(config) {
  const apiRoot = config.PAYDUNYA_MODE === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

  const headers = {
    "content-type": "application/json",
    "PAYDUNYA-MASTER-KEY": config.PAYDUNYA_MASTER_KEY,
    "PAYDUNYA-PRIVATE-KEY": config.PAYDUNYA_PRIVATE_KEY,
    "PAYDUNYA-TOKEN": config.PAYDUNYA_TOKEN
  };

  async function request(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.response_code !== "00") {
      const providerMessage = String(data.response_text || "");
      const kycPending = /KYC|valider vos informations/i.test(providerMessage);
      const error = new Error(kycPending
        ? "Le paiement sécurisé est en cours d’activation. Réessayez un peu plus tard."
        : "Le service de paiement est temporairement indisponible. Réessayez dans un instant.");
      error.statusCode = 503;
      error.providerResponse = data;
      throw error;
    }
    return data;
  }

  return {
    channelsFor(method) {
      return CHANNELS[method] || CHANNELS.all;
    },

    createInvoice(payload) {
      return request(`${apiRoot}/checkout-invoice/create`, {
        method: "POST",
        body: JSON.stringify(payload)
      }).then((data) => {
        let checkout;
        try { checkout = new URL(data.response_text); } catch { checkout = null; }
        if (!checkout || checkout.protocol !== "https:"
            || !/(^|\.)paydunya\.com$/i.test(checkout.hostname)) {
          const error = new Error("Le lien de paiement reçu est invalide.");
          error.statusCode = 502;
          error.providerResponse = data;
          throw error;
        }
        return data;
      });
    },

    confirmInvoice(token) {
      return request(`${apiRoot}/checkout-invoice/confirm/${encodeURIComponent(token)}`);
    },

    verifyCallbackHash(hash) {
      if (typeof hash !== "string" || !/^[a-f0-9]{128}$/i.test(hash)) return false;
      const expected = createHash("sha512").update(config.PAYDUNYA_MASTER_KEY).digest("hex");
      return timingSafeEqual(Buffer.from(hash.toLowerCase()), Buffer.from(expected));
    }
  };
}
