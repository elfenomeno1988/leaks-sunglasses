/* ════════════════════════════════════════════════════════════
   LEAKS — Drop 001 · Variation épurée
   Zéro dépendance. IntersectionObserver, compte à rebours,
   réservation WhatsApp. Rien d'autre.
   ════════════════════════════════════════════════════════════ */

const CONFIG = {
  brandName: "LEAKS",
  whatsappNumber: "2250173891404",
  dropDate: "2026-07-25T20:00:00Z",
  paymentLinks: { "Wave": "", "Orange Money": "", "Djamo": "", "Carte bancaire": "" }
};

const SERVICES = {
  essayage: { label: "Essayage privé", duration: "45 min", amount: 10000, amountLabel: "Acompte à régler", note: "déduit de votre achat" },
  preorder: { label: "Pré-réservation drop", duration: "15 min", amount: 10000, amountLabel: "Acompte à régler", note: "déduit de votre achat" },
  retrait:  { label: "Retrait & ajustage", duration: "15 min", amount: 0, amountLabel: "À régler", note: "" }
};

const SLOT_TIMES = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

const state = { service: "essayage", model: "", date: "", time: "", name: "", phone: "", note: "", payment: "" };

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const fmtFCFA = (n) => n.toLocaleString("fr-FR").replace(/\s/g, " ") + " F CFA";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── Révélations ────────────────────────────────────────────── */

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

$$(".r").forEach((el, i) => {
  if (reducedMotion) { el.classList.add("in"); return; }
  el.style.transitionDelay = `${(i % 4) * 70}ms`;
  io.observe(el);
});

/* ── Compte à rebours ───────────────────────────────────────── */

const dropTime = new Date(CONFIG.dropDate).getTime();
const cd = { d: $("#cd-d"), h: $("#cd-h"), m: $("#cd-m"), s: $("#cd-s") };

function tick() {
  const diff = Math.max(0, dropTime - Date.now());
  cd.d.textContent = String(Math.floor(diff / 864e5)).padStart(2, "0");
  cd.h.textContent = String(Math.floor(diff / 36e5) % 24).padStart(2, "0");
  cd.m.textContent = String(Math.floor(diff / 6e4) % 60).padStart(2, "0");
  cd.s.textContent = String(Math.floor(diff / 1e3) % 60).padStart(2, "0");
}
tick();
setInterval(tick, 1000);

/* ── WhatsApp ───────────────────────────────────────────────── */

const waGeneric = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(`Bonjour ${CONFIG.brandName}, j'aimerais des renseignements sur le Drop 001.`)}`;
$$("[data-wa]").forEach((a) => { a.href = waGeneric; });

const waFloat = $("#wa-float");
window.addEventListener("scroll", () => {
  waFloat.classList.toggle("show", window.scrollY > innerHeight * 0.6);
}, { passive: true });

/* ── Réservation ────────────────────────────────────────────── */

function selectModel(value) {
  state.model = value;
  $$("#models .chip").forEach((c) => c.classList.toggle("is-active", c.dataset.value === value));
  updateSummary();
}

$$("#models .chip").forEach((chip) => {
  chip.addEventListener("click", () => selectModel(chip.dataset.value));
});

$$('input[name="service"]').forEach((input) => {
  input.addEventListener("change", () => {
    state.service = input.value;
    const svc = SERVICES[state.service];
    $("#payment-step").style.display = svc.amount === 0 ? "none" : "";
    if (svc.amount === 0) { state.payment = ""; $$('input[name="payment"]').forEach((p) => (p.checked = false)); }
    updateSummary();
  });
});

/* Date & créneaux */

const dateInput = $("#date");
const slotsWrap = $("#slots");
const dateHint = $("#date-hint");

const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

dateInput.min = todayISO();

function renderSlots() {
  slotsWrap.innerHTML = "";
  if (!state.date) {
    slotsWrap.innerHTML = '<p class="field-hint">Choisissez d\'abord une date.</p>';
    return;
  }
  const isSunday = new Date(state.date + "T00:00:00").getDay() === 0;
  dateHint.textContent = isSunday
    ? "Le studio est fermé le dimanche — choisissez un autre jour."
    : "Le studio est fermé le dimanche.";
  dateHint.classList.toggle("closed", isSunday);
  if (isSunday) { state.time = ""; updateSummary(); return; }

  const isToday = state.date === todayISO();
  const now = new Date();

  SLOT_TIMES.forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = t;
    if (isToday) {
      const [h, m] = t.split(":").map(Number);
      if (h * 60 + m <= now.getHours() * 60 + now.getMinutes() + 59) btn.disabled = true;
    }
    if (t === state.time) btn.classList.add("is-active");
    btn.addEventListener("click", () => {
      state.time = t;
      $$("#slots .chip").forEach((c) => c.classList.toggle("is-active", c === btn));
      updateSummary();
    });
    slotsWrap.appendChild(btn);
  });
}

dateInput.addEventListener("change", () => {
  state.date = dateInput.value;
  state.time = "";
  renderSlots();
  updateSummary();
});

renderSlots();

/* Coordonnées & paiement */

["name", "phone", "note"].forEach((id) => {
  $("#" + id).addEventListener("input", (e) => {
    state[id] = e.target.value.trim();
    updateSummary();
  });
});

$$('input[name="payment"]').forEach((input) => {
  input.addEventListener("change", () => { state.payment = input.value; updateSummary(); });
});

/* Résumé */

const frDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  const s = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function updateSummary() {
  const svc = SERVICES[state.service];
  $("#sum-service").textContent = svc ? `${svc.label} (${svc.duration})` : "—";
  $("#sum-model").textContent = state.model || "À décider sur place";
  $("#sum-date").textContent = state.date ? frDate(state.date) : "—";
  $("#sum-time").textContent = state.time || "—";
  $("#sum-name").textContent = state.name || "—";
  $("#sum-pay").textContent = state.payment || "—";
  $("#sum-total-label").textContent = svc.amountLabel;
  $("#sum-total").textContent = svc.amount === 0 ? "Offert" : fmtFCFA(svc.amount);
}

updateSummary();

/* Validation + envoi WhatsApp */

const form = $("#rdv-form");
const errBox = $("#form-errors");
const successBox = $("#form-success");

function validate() {
  const svc = SERVICES[state.service];
  const missing = [];
  if (!state.date) missing.push({ step: "date", label: "la date" });
  else if (new Date(state.date + "T00:00:00").getDay() === 0) missing.push({ step: "date", label: "un jour d'ouverture (fermé le dimanche)" });
  if (!state.time) missing.push({ step: "date", label: "le créneau" });
  if (!state.name) missing.push({ step: "contact", label: "votre nom" });
  if (!state.phone || state.phone.replace(/\D/g, "").length < 9) missing.push({ step: "contact", label: "un téléphone valide" });
  if (svc.amount > 0 && !state.payment) missing.push({ step: "payment", label: "le moyen de paiement" });
  return missing;
}

function buildWhatsAppMessage() {
  const svc = SERVICES[state.service];
  const lines = [
    `Bonjour ${CONFIG.brandName} ✦ Demande de rendez-vous — Drop 001`,
    "",
    `— Prestation : ${svc.label} (${svc.duration})`,
    state.model ? `— Modèle : ${state.model}` : "— Modèle : à décider sur place",
    `— Date : ${frDate(state.date)} à ${state.time}`,
    `— Nom : ${state.name}`,
    `— Téléphone : ${state.phone}`,
  ];
  if (state.note) lines.push(`— Précisions : ${state.note}`);
  if (svc.amount > 0) {
    lines.push(`— ${svc.amountLabel} : ${fmtFCFA(svc.amount)}${svc.note ? " (" + svc.note + ")" : ""}`);
    lines.push(`— Paiement choisi : ${state.payment}`);
    lines.push("", `Merci de m'envoyer le lien de paiement ${state.payment} pour confirmer ma réservation.`);
  } else {
    lines.push("", "Merci de me confirmer le créneau.");
  }
  return lines.join("\n");
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  $$(".step").forEach((s) => s.classList.remove("has-error"));
  const missing = validate();

  if (missing.length) {
    errBox.hidden = false;
    errBox.textContent = "Merci de préciser : " + missing.map((m) => m.label).join(", ") + ".";
    successBox.hidden = true;
    missing.forEach((m) => { const st = $(`.step[data-step="${m.step}"]`); if (st) st.classList.add("has-error"); });
    const first = $(`.step[data-step="${missing[0].step}"]`);
    if (first) first.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    return;
  }

  errBox.hidden = true;
  const msg = buildWhatsAppMessage();
  window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");

  const directLink = CONFIG.paymentLinks[state.payment];
  $("#success-method").innerHTML = state.payment
    ? `<strong>${state.payment}</strong>` + (directLink ? ` — ou <a href="${directLink}" target="_blank" rel="noopener" style="text-decoration:underline">payez maintenant ↗</a>` : "")
    : "";
  successBox.hidden = false;
  successBox.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
});
