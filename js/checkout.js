const form = document.querySelector("#checkout-form");
const errorBox = document.querySelector("#checkout-error");
const submit = document.querySelector("#checkout-submit");
const params = new URLSearchParams(location.search);
const productId = params.get("product") || "oryx";
const requestedVariant = params.get("variant") || "";
let product;
let deliveryFee = 1000;
let freeDeliveryTiers = ["exclusive"];
let paymentMethods = ["whatsapp_wave"];
let orderOpenAt = "2026-07-24T00:00:00Z";
let maxOrderQuantity = 2;

const money = (value, suffix = " F CFA") => new Intl.NumberFormat("fr-FR").format(value) + suffix;
const $ = (selector) => document.querySelector(selector);

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.error || "Une erreur est survenue.");
    error.fields = data.fields;
    throw error;
  }
  return data;
}

async function initialize() {
  try {
    const catalog = await api("/api/catalog");
    deliveryFee = catalog.deliveryFees.abidjan_delivery;
    orderOpenAt = catalog.orderOpenAt || orderOpenAt;
    maxOrderQuantity = Number(catalog.maxOrderQuantity) || 2;
    freeDeliveryTiers = Array.isArray(catalog.freeDeliveryTiers)
      ? catalog.freeDeliveryTiers : ["exclusive"];
    paymentMethods = Array.isArray(catalog.paymentMethods) && catalog.paymentMethods.length
      ? catalog.paymentMethods : ["whatsapp_wave"];
    document.querySelectorAll('input[name="paymentMethod"]').forEach((input) => {
      const available = paymentMethods.includes(input.value);
      input.closest("label").hidden = !available;
      input.disabled = !available;
    });
    const selectedPayment = form.elements.paymentMethod.value;
    if (!paymentMethods.includes(selectedPayment)) {
      const fallback = form.querySelector(`input[name="paymentMethod"][value="${paymentMethods[0]}"]`);
      if (fallback) fallback.checked = true;
    }
    product = catalog.products.find((entry) => entry.id === productId) || catalog.products[0];
    if (product.tier === "accessory") {
      [...$("#quantity").options].forEach((option, index) => {
        option.textContent = `${index + 1} article${index ? "s" : ""}`;
      });
      $("#package-block").hidden = true;
      $("#package-trust").hidden = true;
    }
    const select = $("#variant");
    product.variants.forEach((variant) => {
      const soldOut = variant.remaining === 0;
      const low = !soldOut && variant.remaining != null && variant.remaining <= 5;
      const label = soldOut ? `${variant.name} — épuisé`
        : low ? `${variant.name} — plus que ${variant.remaining}` : variant.name;
      const option = new Option(label, variant.id);
      option.disabled = soldOut;
      select.add(option);
    });
    const firstAvailable = product.variants.find((variant) => variant.remaining !== 0) || product.variants[0];
    const requested = product.variants.find((variant) => variant.id === requestedVariant);
    select.value = requested && requested.remaining !== 0 ? requested.id : firstAvailable.id;
    $("#product-name").textContent = `${product.name.startsWith("LEAKS") ? product.name : `LEAKS — ${product.name}`} · ${product.sku}`;
    $("#product-description").textContent = product.description;
    updateQuantityAvailability();
    updateSummary();
    updateOpeningState();
  } catch (error) {
    showError("Le catalogue est temporairement indisponible. Réessayez dans un instant.");
    submit.disabled = true;
  }
}

function updateOpeningState() {
  const opens = new Date(orderOpenAt).getTime();
  const isOpen = Number.isFinite(opens) && Date.now() >= opens;
  const variant = selectedVariant();
  const soldOut = variant?.remaining === 0;
  $("#checkout-opening").textContent = soldOut
    ? "Ce coloris est épuisé — choisissez-en un autre."
    : isOpen
      ? (variant?.remaining == null
        ? "Les commandes sont ouvertes."
        : `${variant.remaining} exemplaire${variant.remaining > 1 ? "s" : ""} encore disponible${variant.remaining > 1 ? "s" : ""} dans ce coloris.`)
      : "Bientôt disponible.";
  submit.disabled = !isOpen || soldOut;
  if (!isOpen) {
    submit.title = "Bientôt disponible.";
    setTimeout(updateOpeningState, Math.min(opens - Date.now() + 1000, 2_147_000_000));
  } else if (!soldOut) {
    submit.removeAttribute("title");
  }
}

function selectedVariant() {
  return product?.variants.find((variant) => variant.id === $("#variant").value);
}

function updateQuantityAvailability() {
  const variant = selectedVariant();
  if (!variant) return;
  const available = variant.remaining == null
    ? maxOrderQuantity
    : Math.min(maxOrderQuantity, variant.remaining);
  const quantity = $("#quantity");
  [...quantity.options].forEach((option) => {
    option.disabled = Number(option.value) > available;
  });
  if (Number(quantity.value) > available) {
    const fallback = [...quantity.options].filter((option) => !option.disabled).at(-1);
    if (fallback) quantity.value = fallback.value;
  }
}

function updateSummary() {
  if (!product) return;
  const variant = selectedVariant();
  updateQuantityAvailability();
  const quantity = Number($("#quantity").value);
  const isDelivery = true;
  const freeDelivery = isDelivery && freeDeliveryTiers.includes(product.tier);
  const delivery = isDelivery && !freeDelivery ? deliveryFee : 0;
  const subtotal = product.price * quantity;
  $("#product-image").src = variant.image;
  $("#product-image").alt = `${product.name} — ${variant.name}`;
  $("#summary-variant").textContent = variant.name;
  $("#summary-quantity").textContent = quantity;
  $("#summary-subtotal").textContent = money(subtotal, " F");
  $("#summary-delivery").textContent = isDelivery
    ? (freeDelivery ? "Offerte" : money(delivery, " F"))
    : "Gratuite";
  $("#summary-total").textContent = money(subtotal + delivery);
  $("#submit-total").textContent = money(subtotal + delivery);
  $("#delivery-fee-label").textContent = freeDeliveryTiers.includes(product.tier)
    ? "Offerte avec LEAKS Exclusive"
    : `+ ${money(deliveryFee, " F")}`;
  $("#address-wrap").hidden = false;
  form.elements.deliveryAddress.required = isDelivery;
  const manual = form.elements.paymentMethod.value === "whatsapp_wave";
  submit.querySelector("span").textContent = manual ? "Continuer sur WhatsApp" : "Continuer vers le paiement";
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

form.addEventListener("change", () => {
  updateSummary();
  updateOpeningState();
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  if (Date.now() < new Date(orderOpenAt).getTime()) {
    showError("Bientôt disponible.");
    return;
  }
  if (!form.reportValidity() || !product) return;
  const values = Object.fromEntries(new FormData(form));
  const original = submit.innerHTML;
  submit.disabled = true;
  submit.innerHTML = "<span>Création de la commande…</span>";
  try {
    const result = await api("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, productId: product.id, quantity: Number(values.quantity) })
    });
    sessionStorage.setItem("leaks:last-order", JSON.stringify({ reference: result.order.reference, tracking: result.trackingToken }));
    location.href = result.redirectUrl;
  } catch (error) {
    showError(error.message);
    submit.innerHTML = original;
    updateSummary();
    updateOpeningState();
  }
});

initialize();
