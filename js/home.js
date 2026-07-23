/* LEAKS — Drop 004 · accueil */

const CONFIG = {
  brandName: "LEAKS",
  whatsappNumber: "2250173891404",
  dropDate: "2026-07-25T20:00:00Z",
  orderOpenAt: "2026-07-24T00:00:00Z"
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const money = (value) => `${new Intl.NumberFormat("fr-FR").format(value)} F CFA`;
const models = window.LEAKS_MODELS || [];
const accessories = window.LEAKS_ACCESSORIES || [];

function renderCatalog() {
  const root = $("#catalog-groups");
  if (!root) return;
  const tiers = [
    { id: "classic", label: "LEAKS Classic", note: "19 900 F CFA" },
    { id: "premium", label: "LEAKS Premium", note: "24 900 F CFA" },
    { id: "exclusive", label: "LEAKS Exclusive", note: "29 900 F CFA · livraison offerte à Abidjan" }
  ];
  let position = 0;
  root.innerHTML = tiers.map((tier) => {
    const entries = models.filter((model) => model.tier === tier.id);
    if (!entries.length) return "";
    const cards = entries.map((model) => {
      position += 1;
      const first = model.colors[0];
      const alternate = first.views?.[1]?.src || first.image;
      const colorCount = `${model.colors.length} coloris`;
      return `
        <article class="card r">
          <a class="card-detail" href="/gallery.html?product=${encodeURIComponent(model.id)}">
            <span class="card-visual">
              <img class="base" src="${first.image}" alt="LEAKS ${model.name} — ${first.label}, vue de face" loading="lazy">
              <img class="alt" src="${alternate}" alt="" loading="lazy" aria-hidden="true">
            </span>
            <span class="card-row"><h3><span class="idx">${String(position).padStart(2, "0")}</span> LEAKS — ${model.name}</h3><span class="tag">${model.sku}</span></span>
            <span class="card-sub"><span>${colorCount}</span><span class="price">${money(model.price)}</span></span>
          </a>
          <a class="card-buy" data-order-link data-product-id="${model.id}" data-variant-id="${first.variantId}" href="/checkout.html?product=${encodeURIComponent(model.id)}&amp;variant=${encodeURIComponent(first.variantId)}">Acheter directement</a>
        </article>`;
    }).join("");
    return `
      <section class="catalog-tier" aria-labelledby="tier-${tier.id}">
        <header class="tier-head r">
          <h3 id="tier-${tier.id}">${tier.label}</h3>
          <span>${tier.note}</span>
        </header>
        <div class="grid">${cards}</div>
      </section>`;
  }).join("");
}

function renderAccessories() {
  const root = $("#accessories-grid");
  if (!root) return;
  root.innerHTML = accessories.map((item) => {
    const action = item.purchasable
      ? `<a class="card-buy" data-order-link data-product-id="${item.id}" data-variant-id="${item.variantId}" href="/checkout.html?product=${encodeURIComponent(item.id)}&amp;variant=${encodeURIComponent(item.variantId)}">Acheter directement</a>`
      : `<a class="card-buy" data-wa href="#" target="_blank" rel="noopener">Écrire au concierge</a>`;
    const visual = item.image
      ? `<img src="${item.image}" alt="${item.name}" loading="lazy">`
      : `<span class="accessory-placeholder">LEAKS<br>Travel Case</span>`;
    return `
      <article class="accessory-card r">
        <div class="accessory-visual">${visual}</div>
        <div class="card-row"><h3>${item.name}</h3><span class="price">${money(item.price)}</span></div>
        <p>${item.description}</p>
        ${action}
      </article>`;
  }).join("");
}

renderCatalog();
renderAccessories();

let orderOpenTime = new Date(CONFIG.orderOpenAt).getTime();

function applyOrderGate() {
  const isOpen = Date.now() >= orderOpenTime;
  $$("[data-order-link]").forEach((link) => {
    if (!link.dataset.originalLabel) link.dataset.originalLabel = link.textContent;
    const remaining = link.dataset.remaining === undefined || link.dataset.remaining === ""
      ? null : Number(link.dataset.remaining);
    const soldOut = remaining === 0;
    link.textContent = soldOut
      ? "Épuisé"
      : !isOpen
        ? "Bientôt disponible"
        : remaining != null && remaining <= 2
          ? `${link.dataset.originalLabel} · ${remaining} restant${remaining > 1 ? "s" : ""}`
          : link.dataset.originalLabel;
    link.classList.toggle("is-locked", !isOpen || soldOut);
    link.classList.toggle("is-sold-out", soldOut);
    link.setAttribute("aria-disabled", String(!isOpen || soldOut));
  });
}

async function hydrateAvailability() {
  try {
    const response = await fetch("/api/catalog", { headers: { accept: "application/json" } });
    if (!response.ok) return;
    const catalog = await response.json();
    const opens = new Date(catalog.orderOpenAt).getTime();
    if (Number.isFinite(opens)) orderOpenTime = opens;
    $$("[data-order-link]").forEach((link) => {
      const product = catalog.products?.find((entry) => entry.id === link.dataset.productId);
      if (!product) return;
      let variant = product.variants?.find((entry) => entry.id === link.dataset.variantId);
      if (variant?.remaining === 0) {
        const replacement = product.variants.find((entry) => entry.remaining !== 0);
        if (replacement) {
          variant = replacement;
          link.dataset.variantId = replacement.id;
          link.href = `/checkout.html?product=${encodeURIComponent(product.id)}&variant=${encodeURIComponent(replacement.id)}`;
        }
      }
      link.dataset.remaining = variant?.remaining == null ? "" : String(variant.remaining);
    });
    applyOrderGate();
  } catch {
    /* Le serveur valide aussi le stock au dernier geste. */
  }
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-order-link].is-locked");
  if (!link) return;
  event.preventDefault();
});

applyOrderGate();
hydrateAvailability();
if (Date.now() < orderOpenTime) {
  setTimeout(applyOrderGate, Math.min(orderOpenTime - Date.now() + 1000, 2_147_000_000));
}

/* Révélations */
const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("in");
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }) : null;

$$('.r').forEach((element, index) => {
  if (reducedMotion || !io) {
    element.classList.add("in");
    return;
  }
  element.style.transitionDelay = `${(index % 4) * 70}ms`;
  io.observe(element);
});

/* Compte à rebours */
const dropTime = new Date(CONFIG.dropDate).getTime();
const cd = { d: $("#cd-d"), h: $("#cd-h"), m: $("#cd-m"), s: $("#cd-s") };

function tick() {
  const diff = Math.max(0, dropTime - Date.now());
  cd.d.textContent = String(Math.floor(diff / 864e5)).padStart(2, "0");
  cd.h.textContent = String(Math.floor(diff / 36e5) % 24).padStart(2, "0");
  cd.m.textContent = String(Math.floor(diff / 6e4) % 60).padStart(2, "0");
  cd.s.textContent = String(Math.floor(diff / 1e3) % 60).padStart(2, "0");
}
if (cd.d) {
  tick();
  setInterval(tick, 1000);
}

/* WhatsApp */
const waGeneric = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(`Bonjour ${CONFIG.brandName}, j'aimerais des renseignements sur le Drop 004.`)}`;
$$('[data-wa]').forEach((link) => { link.href = waGeneric; });

const waFloat = $("#wa-float");
if (waFloat) {
  window.addEventListener("scroll", () => {
    waFloat.classList.toggle("show", window.scrollY > innerHeight * 0.6);
  }, { passive: true });
}
