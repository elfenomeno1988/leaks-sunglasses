/*
 * Catalogue client LEAKS.
 * Taxonomie alignée sur assets/img/products/ :
 *   modèle → coloris → vues (front, three-quarter, macro-hinge, macro-lens, …)
 */

(function () {
  const VIEW_LABELS = {
    "front": "Face",
    "three-quarter": "Trois-quarts",
    "macro-hinge": "Charnière",
    "macro-lens": "Monture & verre",
    "interior": "Intérieur",
    "worn-femme": "Portée femme",
    "worn-homme": "Portée homme",
    "details-interior": "Détails intérieur",
    "light-control": "Light Control"
  };

  const views = (model, color, keys) =>
    keys.map((key) => ({
      id: key,
      label: VIEW_LABELS[key] || key,
      src: key === "light-control"
        ? `/assets/img/products/${model}/light-control.png`
        : `/assets/img/products/${model}/${color}/${key}.png`
    }));

  const color = (model, variantId, label, keys) => {
    const list = views(model, variantId, keys);
    return { variantId, label, image: list[0].src, views: list };
  };

  window.LEAKS_MODELS = [
    {
      id: "genesio",
      name: "Genesio",
      sku: "LK-00",
      price: 20000,
      description: "Carrée sculptée, contraste net et rendu studio.",
      colors: [
        color("genesio", "deep-brown", "Deep Brown", ["front", "three-quarter", "macro-hinge", "macro-lens"]),
        color("genesio", "gold", "Gold", ["front", "three-quarter", "macro-hinge", "macro-lens"]),
        color("genesio", "grey-dark", "Grey Dark", ["front", "three-quarter", "macro-hinge", "macro-lens"]),
        color("genesio", "grey-light", "Grey Light", ["front", "three-quarter", "macro-hinge", "macro-lens"])
      ]
    },
    {
      id: "genesis-honey",
      name: "Genesis Honey",
      sku: "LK-01",
      price: 20000,
      description: "Acétate miel, lumière chaude et profil plus doux.",
      colors: [
        color("genesis-honey", "honey", "Honey", ["front", "three-quarter", "macro-hinge"])
      ]
    },
    {
      id: "marco",
      name: "Marco",
      sku: "LK-02",
      price: 20000,
      description: "Rectangle brun-vert avec contrastes nets.",
      colors: [
        color("marco", "brown-green", "Brown Green", ["front", "three-quarter", "macro-hinge", "macro-lens"]),
        color("marco", "olive", "Olive", ["front", "three-quarter", "macro-hinge", "macro-lens"])
      ]
    },
    {
      id: "meral",
      name: "Meral",
      sku: "LK-03",
      price: 20000,
      description: "Noir profond, ligne compacte et tenue sèche.",
      colors: [
        color("meral", "black", "Black", ["front", "three-quarter", "macro-hinge", "macro-lens"])
      ]
    },
    {
      id: "nano",
      name: "Nano",
      sku: "LK-04",
      price: 20000,
      description: "Format micro, verres photochromiques Light Control.",
      colors: [
        color("nano", "grey-black", "Grey Black", ["front", "three-quarter", "macro-hinge", "macro-lens", "light-control"]),
        color("nano", "honey-brown", "Honey Brown", ["front", "three-quarter", "macro-hinge", "light-control"])
      ]
    },
    {
      id: "octa",
      name: "Octa",
      sku: "LK-05",
      price: 20000,
      description: "Huit angles, palette vive et finitions translucides.",
      colors: [
        color("octa", "white-champagne", "White Champagne", ["front", "three-quarter"]),
        color("octa", "clear-blue", "Clear Blue", ["front", "three-quarter"]),
        color("octa", "clear-black", "Clear Black", ["front", "three-quarter"]),
        color("octa", "clear-pink", "Clear Pink", ["front", "three-quarter"]),
        color("octa", "clear-red", "Clear Red", ["front", "three-quarter"]),
        color("octa", "pink-nude", "Pink Nude", ["front", "three-quarter"]),
        color("octa", "blue-gradient", "Blue Gradient", ["three-quarter", "details-interior"]),
        color("octa", "white-honey", "White Honey", ["front", "three-quarter", "macro-hinge"])
      ]
    },
    {
      id: "oryx",
      name: "Oryx",
      sku: "LK-06",
      price: 20000,
      description: "Cadres graphiques, jeux de matières et de contraste.",
      colors: [
        color("oryx", "black-and-white", "Black & White", ["front", "three-quarter", "macro-hinge", "macro-lens", "interior", "worn-femme", "worn-homme"]),
        color("oryx", "cheetah-brown", "Cheetah Brown", ["front"]),
        color("oryx", "gradient-brown", "Gradient Brown", ["front"]),
        color("oryx", "gradient-purple", "Gradient Purple", ["front"])
      ]
    }
  ];
})();

window.LEAKS_MODEL_MAP = Object.fromEntries(window.LEAKS_MODELS.map((model) => [model.id, model]));

window.LEAKS_COLLECTION = window.LEAKS_MODELS.flatMap((model) =>
  model.colors.map((color) => ({
    modelId: model.id,
    modelName: model.name,
    sku: model.sku,
    price: model.price,
    description: model.description,
    colorId: color.variantId,
    colorLabel: color.label,
    image: color.image
  }))
);

window.LEAKS_VARIANT_MAP = Object.fromEntries(
  window.LEAKS_COLLECTION.map((item) => [`${item.modelId}:${item.colorId}`, item])
);
