const params = new URLSearchParams(location.search);
let reference = params.get("reference");
let tracking = params.get("tracking");
const saved = JSON.parse(sessionStorage.getItem("leaks:last-order") || "null");
if ((!reference || !tracking) && saved) ({ reference, tracking } = saved);
const money = (value) => new Intl.NumberFormat("fr-FR").format(value) + " F CFA";

function markProgress(order) {
  const paid = order.paymentStatus === "paid";
  const stages = { pending: true, paid, ready: ["ready", "shipped", "delivered"].includes(order.status), delivered: order.status === "delivered" };
  document.querySelectorAll("#status-progress span").forEach((node) => node.classList.toggle("done", stages[node.dataset.step]));
}

async function refresh() {
  if (!reference || !tracking) return renderError("Lien de suivi incomplet.");
  document.querySelector("#order-reference").textContent = reference;
  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(reference)}?tracking=${encodeURIComponent(tracking)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const order = data.order;
    const paid = order.paymentStatus === "paid";
    const expired = order.paymentExpiresAt && Date.now() > new Date(order.paymentExpiresAt).getTime();
    const failed = ["cancelled", "failed"].includes(order.paymentStatus) || expired;
    document.querySelector("#status-title").textContent = paid ? "Paiement confirmé." : failed ? "Paiement non finalisé." : "Paiement en attente.";
    const manual = order.paymentMethod === "whatsapp_wave";
    document.querySelector("#status-copy").textContent = paid
      ? "Votre paire est réservée. Nous préparons maintenant votre commande."
      : failed
        ? "Aucun débit n’a été confirmé. Vous pouvez recommencer la commande."
        : manual
        ? "Le concierge vérifie votre paiement et mettra ce suivi à jour."
        : "Le statut se mettra à jour automatiquement dès validation par le service de paiement.";
    document.querySelector("#status-product").textContent = `${order.product} × ${order.quantity}`;
    document.querySelector("#status-variant").textContent = order.variant;
    document.querySelector("#status-total").textContent = money(order.totalAmount);
    document.querySelector("#status-delivery").textContent = "Livraison Abidjan";
    document.querySelector("#status-details").hidden = false;
    if (failed && order.productId && order.variantId) {
      const retry = document.querySelector("#retry-link");
      retry.href = `/checkout.html?product=${encodeURIComponent(order.productId)}&variant=${encodeURIComponent(order.variantId)}`;
      retry.hidden = false;
    }
    if (order.receiptUrl) { const link = document.querySelector("#receipt-link"); link.href = order.receiptUrl; link.hidden = false; }
    markProgress(order);
    if (!paid && !failed) setTimeout(refresh, 6000);
  } catch (error) { renderError(error.message || "Commande introuvable."); }
}

function renderError(message) {
  document.querySelector("#status-title").textContent = "Suivi indisponible.";
  document.querySelector("#status-copy").textContent = message;
}
refresh();
