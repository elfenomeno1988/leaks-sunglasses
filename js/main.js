/* ══════════════════════════════════════════════════════════
   LEAKS SUNGLASSES — Drop 004
   Compte à rebours, visionneuse, réservation & paiement WhatsApp
   ══════════════════════════════════════════════════════════ */

/* ── CONFIGURATION — à personnaliser ─────────────────────────
   whatsappNumber : numéro WhatsApp Business, format international
   SANS "+" ni espaces.  dropDate : date/heure du drop (ISO, UTC).
   paymentLinks   : liens de paiement directs (optionnels) — si
   renseigné, un bouton "payer maintenant" apparaît après la
   confirmation pour le moyen choisi.
   ───────────────────────────────────────────────────────── */
const CONFIG = {
  brandName: "LEAKS",
  whatsappNumber: "2250173891404",         // WhatsApp Business — +225 01 73 89 14 04
  dropDate: "2026-07-25T20:00:00Z",
  paymentLinks: {
    "Wave": "",                             // ex: "https://pay.wave.com/m/M_xxxx/c/sn/"
    "Orange Money": "",
    "Djamo": "",
    "Carte bancaire": ""
  }
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
const hasGsap = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
const motionOn = hasGsap && !reducedMotion;

/* ══════════════ MENU MOBILE ══════════════ */

const burger = $("#burger");
const menu = $("#menu");

function toggleMenu(force) {
  const open = force !== undefined ? force : !menu.classList.contains("open");
  menu.classList.toggle("open", open);
  burger.classList.toggle("open", open);
  burger.setAttribute("aria-expanded", String(open));
  menu.setAttribute("aria-hidden", String(!open));
  document.body.style.overflow = open ? "hidden" : "";
}

burger.addEventListener("click", () => toggleMenu());
$$(".menu-links a").forEach((a) => a.addEventListener("click", () => toggleMenu(false)));

/* ══════════════ REVEALS ══════════════ */

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
}, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

/* Les éléments repris par GSAP sortent du circuit IntersectionObserver */
const gsapOwned = (el) =>
  motionOn && (el.closest(".hero") || el.closest(".at-stage") || el.classList.contains("drop-date"));

$$(".reveal").forEach((el, i) => {
  if (gsapOwned(el)) { el.style.transition = "none"; el.classList.add("in"); return; }
  el.style.transitionDelay = `${(i % 3) * 70}ms`;
  io.observe(el);
});

/* ══════════════ COUNTDOWN ══════════════ */

const dropTime = new Date(CONFIG.dropDate).getTime();
const cd = { d: $("#cd-d"), h: $("#cd-h"), m: $("#cd-m"), s: $("#cd-s") };

function updateCountdown() {
  const diff = Math.max(0, dropTime - Date.now());
  cd.d.textContent = String(Math.floor(diff / 864e5)).padStart(2, "0");
  cd.h.textContent = String(Math.floor(diff / 36e5) % 24).padStart(2, "0");
  cd.m.textContent = String(Math.floor(diff / 6e4) % 60).padStart(2, "0");
  cd.s.textContent = String(Math.floor(diff / 1e3) % 60).padStart(2, "0");
}

updateCountdown();
setInterval(updateCountdown, 1000);

/* ══════════════ WHATSAPP FLOTTANT ══════════════ */

const waFloat = $("#wa-float");
const genericWaLink = () =>
  `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(`Bonjour ${CONFIG.brandName}, j'aimerais des renseignements sur le Drop 004.`)}`;

waFloat.href = genericWaLink();
$("#footer-wa").href = genericWaLink();

window.addEventListener("scroll", () => {
  waFloat.classList.toggle("show", window.scrollY > innerHeight * 0.5);
}, { passive: true });

/* ══════════════ VISIONNEUSE GENESIO ══════════════ */

const genesioViews = (color) => ([
  { src: `assets/img/products/genesio/${color}/front.png`,         cap: "Face" },
  { src: `assets/img/products/genesio/${color}/three-quarter.png`, cap: "Trois-quarts" },
  { src: `assets/img/products/genesio/${color}/macro-hinge.png`,   cap: "Charnière" },
  { src: `assets/img/products/genesio/${color}/macro-lens.png`,    cap: "Monture & verre" }
]);

const FRAMES = {
  "deep-brown": genesioViews("deep-brown"),
  "gold": genesioViews("gold"),
  "grey-dark": genesioViews("grey-dark"),
  "grey-light": genesioViews("grey-light")
};

const FRAME_LABELS = {
  "deep-brown": "Deep Brown",
  "gold": "Gold",
  "grey-dark": "Grey Dark",
  "grey-light": "Grey Light"
};

Object.values(FRAMES).flat().forEach((f) => { const i = new Image(); i.src = f.src; });

const viewerImg = $("#viewer-img");
const thumbsWrap = $("#viewer-thumbs");
let colorway = "deep-brown";

function renderViewer(activeIdx = 0) {
  const list = FRAMES[colorway];
  viewerImg.src = list[activeIdx].src;
  if (motionOn) {
    gsap.fromTo(viewerImg, { opacity: 0.3, scale: 0.985 }, { opacity: 1, scale: 1, duration: 0.45, ease: "power2.out", overwrite: true });
  }
  thumbsWrap.innerHTML = "";
  list.forEach((f, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = i === activeIdx ? "on" : "";
    b.setAttribute("aria-label", "Vue : " + f.cap);
    const im = document.createElement("img");
    im.src = f.src;
    im.alt = "";
    b.appendChild(im);
    b.addEventListener("click", () => renderViewer(i));
    thumbsWrap.appendChild(b);
  });
}

renderViewer();

$$("#genesis-colors .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    colorway = chip.dataset.color;
    $$("#genesis-colors .chip").forEach((c) => c.classList.toggle("is-active", c === chip));
    renderViewer(0);
  });
});

$("#genesis-reserve").addEventListener("click", () => {
  selectModel(`GENESIO LK-00 — ${FRAME_LABELS[colorway]}`);
  $("#rendez-vous").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
});

/* ══════════════ CARTES PRODUITS : swap coloris ══════════════ */

$$(".product-img img[data-alt]").forEach((img) => {
  const main = img.getAttribute("src");
  const alt = img.dataset.alt;
  const pre = new Image(); pre.src = alt;
  const card = img.closest(".product");
  card.addEventListener("pointerenter", () => { img.src = alt; });
  card.addEventListener("pointerleave", () => { img.src = main; });
});

/* ══════════════ RÉSERVATION ══════════════ */

$$(".product .try-link").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectModel(btn.closest(".product").dataset.model);
    $("#rendez-vous").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  });
});

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

/* Coordonnées */

["name", "phone", "note"].forEach((id) => {
  $("#" + id).addEventListener("input", (e) => {
    state[id] = e.target.value.trim();
    updateSummary();
  });
});

/* Paiement */

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
    `Bonjour ${CONFIG.brandName} ✦ Demande de rendez-vous — Drop 004`,
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

/* ══════════════ MOTION DESIGN — GSAP ══════════════ */

if (motionOn) {
  gsap.registerPlugin(ScrollTrigger);

  const initMotion = () => {
    gsap.defaults({ ease: "power3.out", duration: 1 });

    /* — Intro hero — */
    const tl = gsap.timeline();
    tl.from(".hero .kicker", { y: 24, opacity: 0, duration: 0.8 }, 0.15)
      .from(".hero-brand", { clipPath: "inset(0 100% 0 0)", duration: 1.15, ease: "power4.inOut" }, 0.3)
      .from(".hero-line", { y: 18, opacity: 0, duration: 0.7 }, "-=0.4")
      .from(".countdown .cd-block", { y: 18, opacity: 0, stagger: 0.07, duration: 0.6 }, "-=0.35")
      .from(".hero-cta .btn", { y: 16, opacity: 0, stagger: 0.08, duration: 0.6 }, "-=0.35")
      .from(".hero-visual", { y: 70, opacity: 0, scale: 0.96, duration: 1.1 }, "-=0.45");

    /* — Dérive du hero au scroll — */
    gsap.to(".hero-brand", {
      yPercent: -16, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });
    gsap.to(".hero-visual img", {
      yPercent: -7, scale: 1.04, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });

    /* — Titres de sections : lignes masquées — */
    if (typeof SplitText !== "undefined") {
      $$(".section-title").forEach((el) => {
        try {
          const split = new SplitText(el, { type: "lines", linesClass: "sl-line", mask: "lines" });
          gsap.from(split.lines, {
            yPercent: 130, duration: 0.95, stagger: 0.1, ease: "power4.out",
            scrollTrigger: { trigger: el, start: "top 84%", once: true }
          });
        } catch (e) { /* fallback silencieux */ }
      });
    }

    /* — Marquee piloté + accélération à la vélocité du scroll — */
    const track = document.querySelector(".marquee-track");
    track.style.animation = "none";
    const loop = gsap.to(track, { xPercent: -50, duration: 26, ease: "none", repeat: -1 });
    ScrollTrigger.create({
      onUpdate: (self) => {
        loop.timeScale(gsap.utils.clamp(1, 4, 1 + Math.abs(self.getVelocity()) / 900));
        gsap.to(loop, { timeScale: 1, duration: 1.1, delay: 0.15, overwrite: "auto" });
      }
    });

    /* — Atelier : parallaxe multi-couches — */
    const stage = document.querySelector(".at-stage");
    $$("[data-at-speed]").forEach((el) => {
      const v = parseFloat(el.dataset.atSpeed);
      gsap.fromTo(el, { y: v / 2 }, {
        y: -v / 2, ease: "none",
        scrollTrigger: { trigger: stage, start: "top bottom", end: "bottom top", scrub: true }
      });
    });

    gsap.fromTo(".atelier-word", { xPercent: 4 }, {
      xPercent: -9, ease: "none",
      scrollTrigger: { trigger: ".atelier", start: "top bottom", end: "bottom top", scrub: true }
    });

    /* Révélation des planches (clip, sans toucher au y scrubé) */
    $$(".at-sketch, .at-knoll").forEach((f, i) => {
      gsap.from(f, {
        clipPath: "inset(10% 12% 10% 12%)", opacity: 0, duration: 1.2, delay: i * 0.06, ease: "power3.out",
        scrollTrigger: { trigger: f, start: "top 88%", once: true }
      });
    });

    gsap.from(".at-fact", {
      opacity: 0, duration: 0.8,
      scrollTrigger: { trigger: ".at-fact", start: "top 90%", once: true }
    });

    /* Compteur 42 */
    const numEl = document.getElementById("at-num");
    const counter = { v: 0 };
    gsap.to(counter, {
      v: 42, duration: 1.6, ease: "power2.out", snap: { v: 1 },
      onUpdate: () => { numEl.textContent = String(Math.round(counter.v)); },
      scrollTrigger: { trigger: ".at-fact", start: "top 90%", once: true }
    });

    /* Notes techniques en cascade */
    gsap.from(".at-notes li", {
      x: 28, opacity: 0, stagger: 0.09, duration: 0.7,
      scrollTrigger: { trigger: ".at-notes", start: "top 88%", once: true }
    });

    /* — Lockup date du drop — */
    gsap.from(".drop-date", {
      y: 54, opacity: 0, scale: 0.98, duration: 1,
      scrollTrigger: { trigger: ".drop-date", start: "top 86%", once: true }
    });

    /* — Spécifications Genesis en cascade — */
    gsap.from(".specs li", {
      y: 16, opacity: 0, stagger: 0.06, duration: 0.55,
      scrollTrigger: { trigger: ".specs", start: "top 86%", once: true }
    });

    ScrollTrigger.refresh();
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(initMotion);
  } else {
    initMotion();
  }
}

/* ══════════════ Hook QA (aperçu hors focus) ══════════════ */

window.__leaks = {
  intro: () => {
    if (hasGsap) {
      ScrollTrigger.getAll().forEach((st) => st.kill());
      gsap.globalTimeline.getChildren(true, true, true).forEach((t) => t.progress(1));
      gsap.set(".hero .kicker, .hero-brand, .hero-line, .countdown .cd-block, .hero-cta .btn, .hero-visual, .hero-visual img, .at-sketch, .at-knoll, .at-fact, .at-notes li, .drop-date, .specs li, .sl-line", { clearProps: "opacity,transform,clipPath,visibility" });
    }
    $$(".reveal").forEach((el) => { el.style.transition = "none"; el.classList.add("in"); });
    const numEl = document.getElementById("at-num");
    if (numEl) numEl.textContent = "42";
  }
};
