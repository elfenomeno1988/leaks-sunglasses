/*
 * Catalogue client LEAKS.
 * Source 2026-07-22 : LEAKS DOCUMENTS.zip
 * Taxonomie : gamme -> modèle -> coloris -> vues.
 */

(function () {
  const VIEW_LABELS = {
    "front": "Face",
    "three-quarter": "Trois-quarts",
    "side": "Profil",
    "back": "Dos",
    "detail": "Détail",
    "macro-hinge": "Charnière",
    "macro-lens": "Monture & verre",
    "interior": "Intérieur",
    "worn-femme": "Portée femme",
    "worn-homme": "Portée homme",
    "details-interior": "Détails intérieur",
    "light-control": "Light Control"
  };

  const views = (model, color, keys) => keys.map((key) => ({
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

  const model = (data) => ({ category: "eyewear", ...data });

  window.LEAKS_MODELS = [
    model({
      id: "oryx", name: "Oryx", sku: "LK-06", tier: "classic", tierLabel: "LEAKS Classic", price: 19900,
      description: "Cadre graphique, contrastes francs et présence sculpturale.",
      colors: [
        color("oryx", "black-and-white", "Black & White", ["front", "three-quarter", "macro-hinge", "macro-lens", "interior", "worn-femme", "worn-homme"]),
        color("oryx", "cheetah-brown", "Cheetah Brown", ["front"]),
        color("oryx", "gradient-brown", "Gradient Brown", ["front"]),
        color("oryx", "gradient-purple", "Gradient Purple", ["front"])
      ]
    }),
    model({
      id: "meral", name: "Meral", sku: "LK-03", tier: "classic", tierLabel: "LEAKS Classic", price: 19900,
      description: "Noir profond, ligne compacte et tenue nette.",
      colors: [color("meral", "black", "Black", ["front", "three-quarter", "macro-hinge", "macro-lens"])]
    }),
    model({
      id: "lisa", name: "Lisa", sku: "LK-10", tier: "classic", tierLabel: "LEAKS Classic", price: 19900,
      description: "Ovale étirée, profil fin et allure graphique.",
      colors: [color("lisa", "original", "Silver Smoke", ["front", "three-quarter"])]
    }),
    model({
      id: "square", name: "Square", sku: "LK-11", tier: "classic", tierLabel: "LEAKS Classic", price: 19900,
      description: "Carrée architecturale, pont métal et verres teintés.",
      colors: [
        color("square", "black-green", "Black Green", ["front", "three-quarter"]),
        color("square", "black-grey", "Black Grey", ["front", "three-quarter"])
      ]
    }),
    model({
      id: "genesis-honey", name: "Genesis", sku: "LK-01", tier: "premium", tierLabel: "LEAKS Premium", price: 24900,
      description: "Browline cristal, pont métal et lumière douce.",
      colors: [
        color("genesis-honey", "crystal-clear", "Crystal Clear", ["front", "three-quarter", "side", "back", "detail"]),
        color("genesis-honey", "honey", "Honey Brown", ["front", "three-quarter", "macro-hinge"])
      ]
    }),
    model({
      id: "genesio", name: "Genesio", sku: "LK-00", tier: "premium", tierLabel: "LEAKS Premium", price: 24900,
      description: "Carrée sculptée, contraste net et rendu précis.",
      colors: [
        color("genesio", "deep-brown", "Deep Brown", ["front", "three-quarter", "macro-hinge", "macro-lens"]),
        color("genesio", "gold", "Gold", ["front", "three-quarter", "macro-hinge", "macro-lens"]),
        color("genesio", "grey-dark", "Grey Dark", ["front", "three-quarter", "macro-hinge", "macro-lens"]),
        color("genesio", "grey-light", "Grey Light", ["front", "three-quarter", "macro-hinge", "macro-lens"])
      ]
    }),
    model({
      id: "luther-clear", name: "Luther Clear", sku: "LK-07", tier: "premium", tierLabel: "LEAKS Premium", price: 24900,
      description: "Browline arrondie, acétate transparent et contraste dense.",
      colors: [
        color("luther-clear", "black", "Black", ["front", "three-quarter"]),
        color("luther-clear", "brown-coffee", "Brown Coffee", ["front", "three-quarter"]),
        color("luther-clear", "brown", "Brown", ["front", "three-quarter"]),
        color("luther-clear", "blue-grey", "Blue Grey", ["front", "three-quarter"]),
        color("luther-clear", "purple-clear", "Purple Clear", ["front", "three-quarter"]),
        color("luther-clear", "green", "Green", ["front", "three-quarter"])
      ]
    }),
    model({
      id: "armando", name: "Armando", sku: "LK-08", tier: "premium", tierLabel: "LEAKS Premium", price: 24900,
      description: "Acétate géométrique, volumes facettés et verres dégradés.",
      colors: [
        color("armando", "brown-green", "Brown Green", ["front", "three-quarter"]),
        color("armando", "blue-green", "Blue Green", ["front", "three-quarter"])
      ]
    }),
    model({
      id: "nano", name: "Nano", sku: "LK-04", tier: "premium", tierLabel: "LEAKS Premium", price: 24900,
      description: "Format micro et verres photochromiques Light Control.",
      colors: [
        color("nano", "grey-black", "Grey Black", ["front", "three-quarter", "macro-hinge", "macro-lens", "light-control"]),
        color("nano", "honey-brown", "Honey Brown", ["front", "three-quarter", "macro-hinge", "light-control"])
      ]
    }),
    model({
      id: "marco", name: "Marco", sku: "LK-02", tier: "exclusive", tierLabel: "LEAKS Exclusive", price: 29900,
      description: "Rectangle brun-vert, finitions profondes et contraste affirmé.",
      colors: [
        color("marco", "brown-green", "Brown Green", ["front", "three-quarter", "macro-hinge", "macro-lens"]),
        color("marco", "olive", "Olive", ["front", "three-quarter", "macro-hinge", "macro-lens"])
      ]
    }),
    model({
      id: "silva", name: "Silva", sku: "LK-09", tier: "exclusive", tierLabel: "LEAKS Exclusive", price: 29900,
      description: "Rimless sculptée, monture bijou et ligne aérienne.",
      colors: [
        color("silva", "black-gold", "Black Gold", ["front", "three-quarter"]),
        color("silva", "chocolat", "Chocolat", ["front", "three-quarter"]),
        color("silva", "blue-grey", "Blue Grey", ["front", "three-quarter"])
      ]
    }),
    model({
      id: "octa", name: "Octa", sku: "LK-05", tier: "exclusive", tierLabel: "LEAKS Exclusive", price: 29900,
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
    })
  ];

  window.LEAKS_ACCESSORIES = [
    {
      id: "travel-pouch", name: "LEAKS Travel Pouch", sku: "ACC-01", price: 5900,
      description: "Pochette argentée matelassée pour protéger votre paire en déplacement.",
      image: "/assets/img/accessories/travel-pouch/silver/standing.png", purchasable: true,
      variantId: "silver", variantLabel: "Silver"
    },
    {
      id: "eyewear-case", name: "LEAKS Travel Case", sku: "ACC-02", price: 14900,
      description: "Coffret de voyage premium en similicuir noir pour protéger et transporter vos lunettes.",
      image: "/assets/img/accessories/travel-case/black/hero.webp",
      views: [
        "/assets/img/accessories/travel-case/black/hero.webp",
        "/assets/img/accessories/travel-case/black/standing.webp",
        "/assets/img/accessories/travel-case/black/logo-detail.webp",
        "/assets/img/accessories/travel-case/black/clasp-detail.webp"
      ],
      purchasable: true, variantId: "black", variantLabel: "Black"
    }
  ];
})();

window.LEAKS_MODEL_MAP = Object.fromEntries(window.LEAKS_MODELS.map((model) => [model.id, model]));

window.LEAKS_COLLECTION = window.LEAKS_MODELS.flatMap((model) => model.colors.map((color) => ({
  modelId: model.id,
  modelName: model.name,
  sku: model.sku,
  tier: model.tier,
  tierLabel: model.tierLabel,
  price: model.price,
  description: model.description,
  colorId: color.variantId,
  colorLabel: color.label,
  image: color.image
})));

window.LEAKS_VARIANT_MAP = Object.fromEntries(
  window.LEAKS_COLLECTION.map((item) => [`${item.modelId}:${item.colorId}`, item])
);
