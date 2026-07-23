const form = document.querySelector("#checkout-form");
const errorBox = document.querySelector("#checkout-error");
const submit = document.querySelector("#checkout-submit");
const params = new URLSearchParams(location.search);
const productId = params.get("product") || "oryx";
const requestedVariant = params.get("variant") || "";
let product;
let deliveryFee = 2000;
let paymentMethods = ["whatsapp_wave"];

const money = (value, suffix = " F CFA") => new Intl.NumberFormat("fr-FR").format(value) + suffix;
const $ = (selector) => document.querySelector(selector);

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Une erreur est survenue.");
    error.fields = data.fields;
    throw error;
  }
  return data;
}

async function initialize() {
  try {
    const catalog = await api("/api/catalog");
    deliveryFee = catalog.deliveryFees.abidjan_delivery;
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
    updateSummary();
  } catch (error) {
    showError("Le catalogue est temporairement indisponible. Réessayez dans un instant.");
    submit.disabled = true;
  }
}

function selectedVariant() {
  return product?.variants.find((variant) => variant.id === $("#variant").value);
}

function updateSummary() {
  if (!product) return;
  const variant = selectedVariant();
  const quantity = Number($("#quantity").value);
  const delivery = form.elements.deliveryMethod.value === "abidjan_delivery" ? deliveryFee : 0;
  const subtotal = product.price * quantity;
  $("#product-image").src = variant.image;
  $("#product-image").alt = `${product.name} — ${variant.name}`;
  $("#summary-variant").textContent = variant.name;
  $("#summary-quantity").textContent = quantity;
  $("#summary-subtotal").textContent = money(subtotal, " F");
  $("#summary-delivery").textContent = delivery ? money(delivery, " F") : "Gratuite";
  $("#summary-total").textContent = money(subtotal + delivery);
  $("#submit-total").textContent = money(subtotal + delivery);
  $("#delivery-fee-label").textContent = `+ ${money(deliveryFee, " F")}`;
  $("#address-wrap").hidden = delivery === 0;
  form.elements.deliveryAddress.required = delivery > 0;
  const manual = form.elements.paymentMethod.value === "whatsapp_wave";
  submit.querySelector("span").textContent = manual ? "Continuer sur WhatsApp" : "Continuer vers le paiement";
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

form.addEventListener("change", updateSummary);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
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
    submit.disabled = false;
    submit.innerHTML = original;
    updateSummary();
  }
});

initialize();
