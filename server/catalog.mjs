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
  const maxQuantity = Number(catalog.maxOrderQuantity) || 2;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantity) {
    throw Object.assign(new Error(`La quantité doit être comprise entre 1 et ${maxQuantity}.`), { statusCode: 400 });
  }
  const editionSize = product.tier === "accessory"
    ? null
    : Number(variant.editionSize || catalog.defaultEditionSize || 2);
  return { product, variant, quantity, editionSize, subtotal: product.price * quantity };
}
