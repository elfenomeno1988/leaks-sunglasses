const PHONE_NUMBER = "2250173891404";
const collectionGrid = document.querySelector("#collection-grid");
const waFloat = document.querySelector("#wa-float");
const waLinks = [...document.querySelectorAll("[data-wa-link]")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const money = (value) => `${new Intl.NumberFormat("fr-FR").format(value)} F CFA`;
const waHref = (message) => `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(message)}`;

function setupWhatsAppLinks() {
  const message = "Bonjour LEAKS, je souhaite prendre rendez-vous.";
  const href = waHref(message);
  waLinks.forEach((link) => {
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener";
  });
  if (waFloat) waFloat.href = href;
}

function renderCollection() {
  if (!collectionGrid || !Array.isArray(window.LEAKS_MODELS)) return;

  collectionGrid.innerHTML = window.LEAKS_MODELS.map((model) => {
    const featuredColor = model.colors[0];
    const galleryUrl = `/gallery.html?product=${encodeURIComponent(model.id)}&variant=${encodeURIComponent(featuredColor.variantId)}`;
    const checkoutUrl = `/checkout.html?product=${encodeURIComponent(model.id)}&variant=${encodeURIComponent(featuredColor.variantId)}`;
    const whatsappUrl = waHref(`Bonjour LEAKS, je veux réserver ${model.name} ${featuredColor.label}.`);
    const colorCount = model.colors.length === 1 ? "1 coloris" : `${model.colors.length} coloris`;
    const ctaLabel = model.colors.length > 1 ? "Voir les coloris" : "Voir la monture";
    return `
      <article class="product-card reveal">
        <a class="product-media" href="${galleryUrl}" aria-label="Ouvrir la galerie de ${model.name} ${featuredColor.label}">
          <span class="product-tag">Vue de face</span>
          <img src="${featuredColor.image}" alt="LEAKS ${model.name} - ${featuredColor.label}" loading="lazy" decoding="async">
        </a>
        <div class="product-body">
          <div class="product-head">
            <h3>${model.name}</h3>
            <strong class="price">${money(model.price)}</strong>
          </div>
          <div class="product-meta">
            <span>${featuredColor.label}</span>
            <span>${colorCount}</span>
          </div>
          <a class="product-link" href="${galleryUrl}">${ctaLabel}</a>
          <div class="product-actions">
            <a class="btn btn-dark btn-sm" href="${checkoutUrl}">Acheter</a>
            <a class="btn btn-line btn-sm" href="${whatsappUrl}" target="_blank" rel="noopener">RDV</a>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function setupReveals() {
  const nodes = [...document.querySelectorAll(".reveal")];
  if (reducedMotion || !("IntersectionObserver" in window)) {
    nodes.forEach((node) => node.classList.add("in"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
  nodes.forEach((node, index) => {
    node.style.transitionDelay = `${Math.min(index, 8) * 60}ms`;
    observer.observe(node);
  });
}

function setupFloatingButton() {
  if (!waFloat) return;
  const toggle = () => {
    waFloat.classList.toggle("show", window.scrollY > window.innerHeight * 0.45);
  };
  toggle();
  window.addEventListener("scroll", toggle, { passive: true });
}

setupWhatsAppLinks();
renderCollection();
setupReveals();
setupFloatingButton();
