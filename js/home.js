/* ════════════════════════════════════════════════════════════
   LEAKS — Drop 001 · Variation épurée
   Zéro dépendance. Révélations, compte à rebours,
   essayage privé sur WhatsApp. Rien d'autre.
   ════════════════════════════════════════════════════════════ */

const CONFIG = {
  brandName: "LEAKS",
  whatsappNumber: "2250173891404",
  dropDate: "2026-07-25T20:00:00Z"
};

const SLOT_TIMES = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

const state = { date: "", time: "", name: "", phone: "", note: "" };

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
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
if (cd.d) { tick(); setInterval(tick, 1000); }

/* ── WhatsApp ───────────────────────────────────────────────── */

const waGeneric = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(`Bonjour ${CONFIG.brandName}, j'aimerais des renseignements sur le Drop 001.`)}`;
$$("[data-wa]").forEach((a) => { a.href = waGeneric; });

const waFloat = $("#wa-float");
if (waFloat) {
  window.addEventListener("scroll", () => {
    waFloat.classList.toggle("show", window.scrollY > innerHeight * 0.6);
  }, { passive: true });
}

/* ── Essayage privé — trois gestes, un message ──────────────── */

const form = $("#rdv-form");

if (form) {
  const dateInput = $("#date");
  const slotsWrap = $("#slots");
  const dateHint = $("#date-hint");
  const errBox = $("#form-errors");
  const successBox = $("#form-success");

  const todayISO = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };

  dateInput.min = todayISO();

  const frDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    const s = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  function updateSummary() {
    $("#sum-date").textContent = state.date ? frDate(state.date) : "—";
    $("#sum-time").textContent = state.time || "—";
    $("#sum-name").textContent = state.name || "—";
  }

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

  ["name", "phone", "note"].forEach((id) => {
    $("#" + id).addEventListener("input", (e) => {
      state[id] = e.target.value.trim();
      updateSummary();
    });
  });

  renderSlots();
  updateSummary();

  function validate() {
    const missing = [];
    if (!state.date) missing.push({ step: "date", label: "la date" });
    else if (new Date(state.date + "T00:00:00").getDay() === 0) missing.push({ step: "date", label: "un jour d'ouverture (fermé le dimanche)" });
    if (!state.time) missing.push({ step: "date", label: "le créneau" });
    if (!state.name) missing.push({ step: "contact", label: "votre nom" });
    if (!state.phone || state.phone.replace(/\D/g, "").length < 9) missing.push({ step: "contact", label: "un téléphone valide" });
    return missing;
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
    const lines = [
      `Bonjour ${CONFIG.brandName} ✦ Essayage privé — Drop 001`,
      "",
      `— Date : ${frDate(state.date)} à ${state.time}`,
      `— Nom : ${state.name}`,
      `— Téléphone : ${state.phone}`
    ];
    if (state.note) lines.push(`— Note : ${state.note}`);
    lines.push("", "Merci de me confirmer le créneau.");

    window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener");
    successBox.hidden = false;
    successBox.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  });
}
