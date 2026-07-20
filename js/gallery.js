const PHONE_NUMBER = "2250173891404";
const params = new URLSearchParams(window.location.search);
const requestedProduct = params.get("product") || params.get("model") || "";
const requestedVariant = params.get("variant") || params.get("color") || "";

const titleNode = document.querySelector("[data-gallery-title]");
const copyNode = document.querySelector("[data-gallery-copy]");
const imageNode = document.querySelector("[data-gallery-image]");
const viewsNode = document.querySelector("[data-gallery-views]");
const viewTagNode = document.querySelector("[data-gallery-view-tag]");
const modelNode = document.querySelector("[data-gallery-model]");
const colorNode = document.querySelector("[data-gallery-color]");
const skuNode = document.querySelector("[data-gallery-sku]");
const priceNode = document.querySelector("[data-gallery-price]");
const swatchesNode = document.querySelector("[data-gallery-swatches]");
const buyNode = document.querySelector("[data-gallery-buy]");
const rdvNode = document.querySelector("[data-gallery-rdv]");
const waLinks = [...document.querySelectorAll("[data-wa-link]")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const money = (value) => `${new Intl.NumberFormat("fr-FR").format(value)} F CFA`;
const waHref = (message) => `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(message)}`;

const modelMap = window.LEAKS_MODEL_MAP || Object.fromEntries((window.LEAKS_MODELS || []).map((model) => [model.id, model]));
const defaultModel = (window.LEAKS_MODELS || []).find((model) => model.colors.length > 1) || window.LEAKS_MODELS?.[0];
let currentModel = modelMap[requestedProduct] || defaultModel;
let currentVariant = currentModel?.colors.find((color) => color.variantId === requestedVariant) || currentModel?.colors[0];
let currentViewIndex = 0;

const variantViews = (variant) =>
  (variant.views && variant.views.length ? variant.views : [{ id: "front", label: "Face", src: variant.image }]);

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

function updateWhatsAppLinks() {
  if (!currentModel || !currentVariant) return;
  const message = `Bonjour LEAKS, je veux réserver ${currentModel.name} ${currentVariant.label}.`;
  const href = waHref(message);
  waLinks.forEach((link) => {
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener";
  });
  if (rdvNode) {
    rdvNode.href = href;
    rdvNode.target = "_blank";
    rdvNode.rel = "noopener";
  }
}

function updateLocation() {
  const url = new URL(window.location.href);
  url.searchParams.set("product", currentModel.id);
  url.searchParams.set("variant", currentVariant.variantId);
  window.history.replaceState({}, "", url);
}

function renderViews() {
  const list = variantViews(currentVariant);
  const view = list[currentViewIndex] || list[0];

  imageNode.src = view.src;
  imageNode.alt = `LEAKS ${currentModel.name} - ${currentVariant.label} - ${view.label}`;
  if (viewTagNode) viewTagNode.textContent = view.label;

  if (viewsNode) {
    viewsNode.innerHTML = list.map((v, i) => `
      <button type="button" class="g-view${i === currentViewIndex ? " is-active" : ""}" data-view="${i}" aria-label="Vue : ${v.label}" aria-pressed="${i === currentViewIndex}">
        <img src="${v.src}" alt="">
        <em>${v.label}</em>
      </button>
    `).join("");
    viewsNode.classList.toggle("is-single", list.length < 2);
    [...viewsNode.querySelectorAll("[data-view]")].forEach((button) => {
      button.addEventListener("click", () => {
        const next = Number(button.dataset.view);
        if (next === currentViewIndex) return;
        currentViewIndex = next;
        renderViews();
        if (!reducedMotion) {
          imageNode.animate([
            { opacity: 0.3, transform: "scale(0.985)" },
            { opacity: 1, transform: "scale(1)" }
          ], { duration: 260, easing: "ease-out" });
        }
      });
    });
  }
}

function render() {
  if (!currentModel || !currentVariant) return;

  titleNode.textContent = `${currentModel.name}`;
  copyNode.textContent = `${currentModel.description} Un modèle, plusieurs coloris.`;
  renderViews();
  modelNode.textContent = `${currentModel.name} · ${currentModel.sku}`;
  colorNode.textContent = currentVariant.label;
  skuNode.textContent = currentModel.sku;
  priceNode.textContent = money(currentModel.price);
  buyNode.href = `/checkout.html?product=${encodeURIComponent(currentModel.id)}&variant=${encodeURIComponent(currentVariant.variantId)}`;
  updateWhatsAppLinks();
  updateLocation();

  swatchesNode.innerHTML = currentModel.colors.map((color) => {
    const active = color.variantId === currentVariant.variantId ? " is-active" : "";
    return `
      <button type="button" class="g-swatch${active}" data-variant="${color.variantId}" aria-pressed="${color.variantId === currentVariant.variantId}">
        <img src="${color.image}" alt="">
        <span>
          <strong>${color.label}</strong>
          <em>${variantViews(color).length} vue${variantViews(color).length > 1 ? "s" : ""}</em>
        </span>
      </button>
    `;
  }).join("");

  [...swatchesNode.querySelectorAll("[data-variant]")].forEach((button) => {
    button.addEventListener("click", () => {
      const next = currentModel.colors.find((color) => color.variantId === button.dataset.variant);
      if (!next || next.variantId === currentVariant.variantId) return;
      currentVariant = next;
      currentViewIndex = 0;
      render();
    });
  });

  if (!reducedMotion) {
    imageNode.animate([
      { opacity: 0.3, transform: "scale(0.985)" },
      { opacity: 1, transform: "scale(1)" }
    ], { duration: 260, easing: "ease-out" });
  }
}

if (currentModel && currentVariant) {
  render();
}

setupReveals();
