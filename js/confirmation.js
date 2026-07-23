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
    document.querySelector("#status-title").textContent = paid ? "Paiement confirmé." : order.paymentStatus === "cancelled" ? "Paiement annulé." : "Paiement en attente.";
    document.querySelector("#status-copy").textContent = paid ? "Votre paire est réservée. Nous préparons maintenant votre commande." : "Le statut se mettra à jour automatiquement dès validation par le service de paiement.";
    document.querySelector("#status-product").textContent = `${order.product} × ${order.quantity}`;
    document.querySelector("#status-variant").textContent = order.variant;
    document.querySelector("#status-total").textContent = money(order.totalAmount);
    document.querySelector("#status-delivery").textContent = order.deliveryMethod === "pickup" ? "Retrait studio" : "Livraison Abidjan";
    document.querySelector("#status-details").hidden = false;
    if (order.receiptUrl) { const link = document.querySelector("#receipt-link"); link.href = order.receiptUrl; link.hidden = false; }
    markProgress(order);
    if (!paid && !["cancelled", "failed"].includes(order.paymentStatus)) setTimeout(refresh, 6000);
  } catch (error) { renderError(error.message || "Commande introuvable."); }
}

function renderError(message) {
  document.querySelector("#status-title").textContent = "Suivi indisponible.";
  document.querySelector("#status-copy").textContent = message;
}
refresh();
