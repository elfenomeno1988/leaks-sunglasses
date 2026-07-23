const loginView = document.querySelector("#login-view");
const dashboard = document.querySelector("#dashboard-view");
const ordersBody = document.querySelector("#orders-body");
const dialog = document.querySelector("#order-dialog");
let currentOrders = [];

const money = (value) => new Intl.NumberFormat("fr-FR").format(value) + " F";
const date = (value) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const labels = {
  paid: "Payé", pending: "En attente", manual_review: "À vérifier", failed: "Échoué", cancelled: "Annulé", refunded: "Remboursé",
  pending_payment: "Paiement attendu", confirmed: "Confirmée", preparing: "Préparation", ready: "Prête", shipped: "Expédiée", delivered: "Livrée"
};

const bookingLabels = { pending: "À confirmer", confirmed: "Confirmé", honored: "Honoré", cancelled: "Annulé" };
const frDay = (iso) => {
  const s = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${String(iso).slice(0, 10)}T00:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || "Erreur serveur"), { status: response.status });
  return data;
}

async function boot() {
  try {
    const { admin } = await api("/api/admin/me");
    showDashboard(admin);
  } catch { loginView.hidden = false; dashboard.hidden = true; }
}

function showDashboard(admin) {
  loginView.hidden = true; dashboard.hidden = false;
  document.querySelector("#admin-email").textContent = admin.email;
  loadOrders();
  loadBookings();
}

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const error = document.querySelector("#login-error"); error.hidden = true;
  try {
    const { admin } = await api("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    showDashboard(admin);
  } catch (failure) { error.textContent = failure.message; error.hidden = false; }
});

document.querySelector("#logout").addEventListener("click", async () => { await api("/api/admin/logout", { method: "POST" }); location.reload(); });
document.querySelector("#filters-form").addEventListener("submit", (event) => { event.preventDefault(); loadOrders(); });

async function loadOrders() {
  const query = new URLSearchParams(new FormData(document.querySelector("#filters-form")));
  [...query].forEach(([key, value]) => { if (!value) query.delete(key); });
  try {
    const data = await api(`/api/admin/orders?${query}`);
    currentOrders = data.orders;
    document.querySelector("#stat-revenue").textContent = money(data.stats.revenue);
    document.querySelector("#stat-paid").textContent = data.stats.paid_orders;
    document.querySelector("#stat-pending").textContent = data.stats.pending;
    document.querySelector("#stat-orders").textContent = data.stats.orders;
    renderOrders();
  } catch (error) { if (error.status === 401) location.reload(); }
}

function renderOrders() {
  ordersBody.innerHTML = "";
  document.querySelector("#orders-empty").hidden = currentOrders.length > 0;
  currentOrders.forEach((order) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td><strong>${escapeHtml(order.reference)}</strong><small>${date(order.created_at)}</small></td>
      <td>${escapeHtml(order.customer_name)}<small>+${escapeHtml(order.customer_phone)}</small></td>
      <td>${escapeHtml(order.product_name)} · ${escapeHtml(order.variant_name)}<small>× ${order.quantity}</small></td>
      <td><span class="badge badge-${order.payment_status}">${labels[order.payment_status] || order.payment_status}</span><small>${escapeHtml(order.payment_method)}</small></td>
      <td><strong>${money(order.total_amount)}</strong></td>
      <td><span class="badge">${labels[order.status] || order.status}</span></td>
      <td><button type="button" class="table-action">Ouvrir</button></td>`;
    row.querySelector("button").addEventListener("click", () => openOrder(order));
    ordersBody.appendChild(row);
  });
}

function openOrder(order) {
  const content = document.querySelector("#dialog-content");
  content.innerHTML = `<p class="kicker">${escapeHtml(order.reference)}</p><h2>${escapeHtml(order.product_name)} — ${escapeHtml(order.variant_name)}</h2>
    <dl class="dialog-details"><div><dt>Client</dt><dd>${escapeHtml(order.customer_name)}</dd></div><div><dt>Téléphone</dt><dd>+${escapeHtml(order.customer_phone)}</dd></div>
    <div><dt>E-mail</dt><dd>${escapeHtml(order.customer_email)}</dd></div><div><dt>Livraison</dt><dd>${escapeHtml(order.delivery_address || "Adresse à confirmer")}</dd></div>
    <div><dt>Paiement</dt><dd>${labels[order.payment_status] || order.payment_status}</dd></div><div><dt>Total</dt><dd>${money(order.total_amount)}</dd></div></dl>
    <form id="order-update" class="dialog-form"><label>Statut<select name="status">${["pending_payment","confirmed","preparing","ready","shipped","delivered","cancelled"].map((status) => `<option value="${status}" ${status === order.status ? "selected" : ""}>${labels[status]}</option>`).join("")}</select></label>
    ${order.payment_provider === "manual" ? `<label>Paiement manuel<select name="paymentStatus">${["pending","paid","cancelled","refunded"].map((status) => `<option value="${status}" ${status === order.payment_status ? "selected" : ""}>${labels[status]}</option>`).join("")}</select></label>` : ""}
    <label>Note interne<textarea name="adminNote" rows="4">${escapeHtml(order.admin_note || "")}</textarea></label><button class="btn btn-dark btn-xl" type="submit">Enregistrer</button></form>`;
  content.querySelector("#order-update").addEventListener("submit", async (event) => {
    event.preventDefault();
    await api(`/api/admin/orders/${encodeURIComponent(order.reference)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    dialog.close(); loadOrders();
  });
  dialog.showModal();
}

document.querySelector("#export-csv").addEventListener("click", () => {
  const header = ["reference","date","client","telephone","email","produit","coloris","quantite","paiement","statut","total_xof"];
  const rows = currentOrders.map((o) => [o.reference,o.created_at,o.customer_name,o.customer_phone,o.customer_email,o.product_name,o.variant_name,o.quantity,o.payment_status,o.status,o.total_amount]);
  const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = `leaks-commandes-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
});

/* ── Le carnet d'essayages ─────────────────────────────────── */

const bookingsBody = document.querySelector("#bookings-body");

async function loadBookings() {
  try {
    const { bookings } = await api("/api/admin/bookings");
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = bookings.filter((b) => String(b.booking_date).slice(0, 10) >= today);
    document.querySelector("#bookings-empty").hidden = upcoming.length > 0;
    bookingsBody.innerHTML = "";
    upcoming.forEach((b) => {
      const row = document.createElement("tr");
      const actions = [];
      if (b.status === "pending") actions.push(["confirmed", "Confirmer"], ["cancelled", "Annuler"]);
      if (b.status === "confirmed") actions.push(["honored", "Honoré"], ["cancelled", "Annuler"]);
      row.innerHTML = `<td><strong>${escapeHtml(b.reference)}</strong></td>
        <td>${frDay(b.booking_date)}<small>${escapeHtml(b.booking_time)}</small></td>
        <td>${escapeHtml(b.customer_name)}<small>${escapeHtml(b.customer_phone)}</small></td>
        <td>${escapeHtml(b.customer_note || "—")}</td>
        <td><span class="badge badge-${b.status === "confirmed" || b.status === "honored" ? "paid" : b.status === "cancelled" ? "cancelled" : "pending"}">${bookingLabels[b.status] || b.status}</span></td>
        <td>${actions.map(([s, t]) => `<button type="button" class="table-action" data-status="${s}">${t}</button>`).join(" ")}</td>`;
      row.querySelectorAll("[data-status]").forEach((button) => {
        button.addEventListener("click", async () => {
          await api(`/api/admin/bookings/${encodeURIComponent(b.reference)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: button.dataset.status })
          });
          loadBookings();
        });
      });
      bookingsBody.appendChild(row);
    });
  } catch (error) { if (error.status === 401) location.reload(); }
}

function escapeHtml(value) { const node = document.createElement("span"); node.textContent = String(value); return node.innerHTML; }
boot();
