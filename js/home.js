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
