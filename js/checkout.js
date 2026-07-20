const form = document.querySelector("#checkout-form");
const errorBox = document.querySelector("#checkout-error");
const submit = document.querySelector("#checkout-submit");
const params = new URLSearchParams(location.search);
const productId = params.get("product") || "genesio";
const requestedVariant = params.get("variant") || "";
let product;
let deliveryFee = 2000;

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
    product = catalog.products.find((entry) => entry.id === productId) || catalog.products[0];
    const select = $("#variant");
    product.variants.forEach((variant) => select.add(new Option(variant.name, variant.id)));
    select.value = product.variants.some((variant) => variant.id === requestedVariant) ? requestedVariant : product.variants[0].id;
    $("#product-name").textContent = `${product.name} — ${product.sku}`;
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
