import { readFile } from "node:fs/promises";

const catalogUrl = new URL("../data/catalog.json", import.meta.url);

export async function loadCatalog() {
  const data = JSON.parse(await readFile(catalogUrl, "utf8"));
  const products = new Map(data.products.map((product) => [product.id, product]));
  return { ...data, products, list: data.products };
}

export function resolveLineItem(catalog, productId, variantId, quantity) {
  const product = catalog.products.get(productId);
  if (!product) throw Object.assign(new Error("Produit introuvable."), { statusCode: 400 });
  const variant = product.variants.find((entry) => entry.id === variantId);
  if (!variant) throw Object.assign(new Error("Coloris introuvable."), { statusCode: 400 });
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 3) {
    throw Object.assign(new Error("La quantité doit être comprise entre 1 et 3."), { statusCode: 400 });
  }
  return { product, variant, quantity, subtotal: product.price * quantity };
}
