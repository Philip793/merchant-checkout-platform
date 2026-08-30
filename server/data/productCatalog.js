// Authoritative Product Catalog
//
// IMPORTANT: This is the single source of truth for customer-visible product
// identity and pricing. The frontend reads this catalogue through GET /products.
// Payment calculations also use this exact data server-side. Never accept product
// names, prices, or SKUs from the client when creating a payment.

const products = [
  {
    id: 1,
    name: "Oversized 25MM Cat's Eye Gemstone Damage Dice (Set of 2) - Flesh and Blood TCG ",
    price: 24.99,
    category: "Flesh and Blood",
    description:
      "**US customers: Tariff charges are already included in the shipping cost. No surprise customs fees!**\n\nEnhance your Flesh and Blood TCG experience with this stunning pair of custom-crafted Cat’s Eye Gemstone Damage Dice. Designed specifically for use with the Flesh and Blood trading card game, these unique dice let you easily track damage values from 1–12 while adding a touch of luxury and mystique to your setup.\n\nThe dice are crafted from genuine Cat’s Eye Gemstone, known for its distinctive chatoyant shimmer and smooth, weighty feel.\n\n***What’s Included***\n- 2 × Cat’s Eye Gemstone Damage Dice (1–6 and 7–12)\n- Comes packaged in a velvet drawstring bag for protection and presentation.\n\n\n***Dimensions & Weight***\n- Weight: Each die weighs approximately 41 grams, providing a satisfying heft and premium tactile experience.\n- Size: approx. 25mm each (larger than standard dice for easier handling and visibility)\n\n***Disclaimer:***\nThis listing is for two dice which form a complete set to represent damage values 1-12. This is an unofficial, fan-made accessory designed to be compatible with the Flesh and Blood TCG. It is not affiliated with, endorsed by, or associated with Legend Story Studios or any of their official products. ",
    features: [
      " Made from authentic Cat’s Eye Gemstone, giving each die a natural shimmer that catches the light beautifully.",
      " The colour of the dice is a deep dark purple hue with silver numbering.",
      " Includes two dice — one numbered 1–6 and the other 7–12 — perfect for displaying damage in Flesh and Blood TCG.",
      " Every die is individually checked to ensure consistent engraving depth and polish for a smooth, balanced roll.",
    ],
    images: {
      thumbnail: "/images/products/1-dice-set/thumbnail.jpg",
      main: "/images/products/1-dice-set/1.jpg",
      gallery: [
        "/images/products/1-dice-set/1.jpg",
        "/images/products/1-dice-set/2.jpg",
        "/images/products/1-dice-set/3.jpg",
        "/images/products/1-dice-set/4.jpg",
        "/images/products/1-dice-set/5.jpg",
      ],
    },
    image: "/images/products/1-dice-set/thumbnail.jpg",
    inventory: 25,
    ratings: {
      average: 4.8,
      reviews: 127,
    },
    tags: [
      "Flesh and Blood",
      "Dice",
      "Gemstone",
      "Damage Dice",
    ],
    featured: true,
    newArrival: false,
    bestseller: true,
    sku: "MG-EBG-001",
  },

  {
    id: 2,
    name: "18MM Cat’s Eye Gemstone D6 Dice – Luxury Luminous Gemstone",
    price: 13.05,
    category: [
      "DnD",
      "TCG",
      "Board Game",
    ],
    description:
      "**US customers: Tariff charges are already included in the shipping cost. No surprise customs fees!**\n\nAdd mystique and natural beauty to every roll with our 18mm Cat’s Eye Gemstone D6 Dice, crafted from genuine cat’s eye stone. Unlike synthetic alternatives, these dice showcase the true optical phenomenon known as chatoyancy—a luminous band of light that appears to glide across the surface as the dice move!\n\nPerfect for DnD, TCGs, and board games, these gemstone dice combine premium materials with functional, everyday playability.\n***What's Included***\n- 2 × Cat's Eye Gemstone Damage Dice (1–6 and 7–12)\n- Comes packaged in a velvet drawstring bag for protection and presentation.\n\n\n***Dimensions & Weight***\nDice Size: 18mm\n▶ Material: Genuine cat’s eye gemstone\n▶ Finish: Polished stone with natural chatoyancy\n▶ Weight: One 18mm D6 weights approx. 15g providing a substantial weighty feel.\n\n***Disclaimer:***\nAs this product is made from natural stone, each die is unique—variations in colour, band intensity, and pattern are normal and part of the gemstone’s natural beauty. ",
    features: [
      "✅ Made from genuine gemstone, not resin or fiber-optic substitutes.",
      "✅ Natural Chatoyancy Effect – A bright, moving line of light creates a dynamic, living appearance with every roll.",
      "✅ These die are larger than standard dice which are usually 16mm for better visibility and satisfying table presence.",
      "✅ Ideal for DnD, tabletop RPGs, TCG counters, board games, and collectors.",
      "✅ Smooth, polished finish designed for both play and display.",
    ],
    images: {
      thumbnail: "/images/products/18-cat-d6/thumbnail.webp",
      main: "/images/products/18-cat-d6/1.jpg.webp",
      gallery: [
        "/images/products/18-cat-d6/1.jpg.webp",
        "/images/products/18-cat-d6/2.jpg.webp",
        "/images/products/18-cat-d6/3.jpg.webp",
        "/images/products/18-cat-d6/4.jpg.webp",
        "/images/products/18-cat-d6/5.jpg.webp",
        "/images/products/18-cat-d6/6.jpg.webp",
        "/images/products/18-cat-d6/7.jpg.webp",
      ],
    },
    image: "/images/products/18-cat-d6/thumbnail.webp",
    inventory: 18,
    ratings: {
      average: 4.9,
      reviews: 89,
    },
    tags: [
      "DnD",
      "TCG",
      "Board Game",
      "Gemstone",
      "Damage Dice",
    ],
    featured: true,
    newArrival: true,
    bestseller: false,
    sku: "MG-SMC-002",
  },

  {
    id: 3,
    name: "18MM Rainbow Frosted Crystal Glass D6 Dice – Luxury Gemstone Dice",
    price: 23.4,
    category: [
      "DnD",
      "TCG",
      "Board Game",
    ],
    description:
      "**US customers: Tariff charges are already included in the shipping cost. No surprise customs fees!**\n\nBring brilliance to every roll with our 18mm Frosted Crystal Glass D6 Dice, designed to elevate your tabletop experience across DnD, TCGs, and board games. Crafted from premium crystal glass, each die refracts light like a prism—creating stunning, multi-colour reflections that look incredible on any gaming table.\n\nWhether you need a single standout die or a coordinated set for your favourite game, these dice combine visual impact with precision craftsmanship.\n\n***Dimensions & Weight***\n▶Dice Size: 18mm\n▶Material: Frosted Crystal Glass\n▶Finish: Polished, light-refracting prism effect\n▶Weight: One 18mm D6 weights approx. 15g providing a substantial weighty feel.",
    features: [
      "✅ Premium Frosted Rainbow Crystal Glass – High-clarity glass that reflects and disperses light into vibrant colour spectra.",
      "✅ Larger than standard dice for better visibility and a satisfying weighty feel.",
      "✅ Perfect for DnD, tabletop RPGs, TCG counters, board games, and dice collectors.",
      "✅ Elegant & Durable – Smooth polished finish designed for long-term use and display.",
    ],
    images: {
      thumbnail: "/images/products/18-mm-rainbow-d6/thumbnail.webp",
      main: "/images/products/18-mm-rainbow-d6/1.jpg.avif",
      gallery: [
        "/images/products/18-mm-rainbow-d6/1.jpg.avif",
        "/images/products/18-mm-rainbow-d6/2.jpg.jpg",
        "/images/products/18-mm-rainbow-d6/3.jpg.avif",
        "/images/products/18-mm-rainbow-d6/4.jpg.avif",
        "/images/products/18-mm-rainbow-d6/5.jpg.jpg",
        "/images/products/18-mm-rainbow-d6/6.jpg.avif",
        "/images/products/18-mm-rainbow-d6/7.jpg.avif",
        "/images/products/18-mm-rainbow-d6/8.jpg.avif",
      ],
    },
    image: "/images/products/18-mm-rainbow-d6/thumbnail.webp",
    inventory: 42,
    ratings: {
      average: 4.7,
      reviews: 203,
    },
    tags: [
      "DnD",
      "TCG",
      "Board Game",
      "Glass",
      "Damage Dice",
    ],
    featured: true,
    newArrival: false,
    bestseller: true,
    sku: "MG-FFB-003",
  },

  {
    id: 4,
    name: "18MM Opalite Gemstone D6 Dice – Luxury Iridescent Gemstone Dice",
    price: 18,
    category: [
      "DnD",
      "TCG",
      "Board Game",
    ],
    description:
      "**US customers: Tariff charges are already included in the shipping cost. No surprise customs fees!**\n\nBring an ethereal glow to every roll with our 18mm Opalite Gemstone D6 Dice. Crafted from premium opalite stone, these dice feature a mesmerising opalescent shimmer that shifts between soft blues, milky whites, and warm amber tones depending on the light.\n\nPerfect for DnD, TCGs, and board games, these gemstone dice balance visual beauty with everyday playability.\n\n\n***Dimensions & Weight***\n▶ Dice Size: 18mm\n▶ Material: Opalite gemstone\n▶ Finish: Polished stone with dreamy moonlike glow\n▶ Weight: One 18mm D6 weighs approx. 15g, providing a substantial, premium feel.\n\n***Disclaimer:***\nWhile each die still features unique colour shifts and internal glow patterns, making every piece visually distinctive,minor variations are normal and part of the stone’s charm.\n",
    features: [
      "✅ Crafted from polished opalite stone for a smooth, luminous finish.",
      "✅ Known for its dreamy, moonlike appearance, opalite is a favourite among collectors and players who want their dice to stand out with subtle elegance rather than bold flash.",
      "✅ Oversized Dice – Larger than standard 16mm dice for improved visibility and satisfying table presence.",
      "✅ Smooth, polished surface designed for both gameplay and display. Ideal for DnD, tabletop RPGs, TCG counters, board games, and collectors.",
    ],
    images: {
      thumbnail: "/images/products/18mm-opa-d6/thumbnail.avif",
      main: "/images/products/18mm-opa-d6/1.jpg.jpg",
      gallery: [
        "/images/products/18mm-opa-d6/1.jpg.jpg",
        "/images/products/18mm-opa-d6/2.jpg.avif",
        "/images/products/18mm-opa-d6/3.jpg.jpg",
        "/images/products/18mm-opa-d6/4.jpg.jpg",
        "/images/products/18mm-opa-d6/5.jpg.jpg",
        "/images/products/18mm-opa-d6/6.jpg.avif",
        "/images/products/18mm-opa-d6/7.jpg.jpg",
        "/images/products/18mm-opa-d6/8.jpg.avif",
      ],
    },
    image: "/images/products/18mm-opa-d6/thumbnail.avif",
    inventory: 12,
    ratings: {
      average: 4.9,
      reviews: 156,
    },
    tags: [
      "DnD",
      "TCG",
      "Board Game",
      "Gemstone",
      "Damage Dice",
    ],
    featured: false,
    newArrival: false,
    bestseller: true,
    sku: "MG-CC-004",
  },

  {
    id: 5,
    name: "Metal Resource Token Set",
    price: 13.99,
    category: "Flesh and Blood",
    description:
      "**US customers: Tariff charges are already included in the shipping cost. No surprise customs fees!**\n\nElevate your trading card game experience with this meticulously crafted custom metal resource token, designed for compatibility with the Flesh and Blood TCG. This double-sided token features distinct designs on each side, representing 1 and 2 resources respectively, enhancing gameplay efficiency and aesthetic appeal.\n\n\n***Dimensions & Weight***\n▶▶ The coin measures approx. 43mm in diameter and 3mm in thickness, it's the perfect size for ease of use without obstructing play.\n▶▶ The coins weighs approx. 25 grams, offering a substantial and weighty feel in the hands, comparable to holding two Australian 50-cent coins.\n\n***Disclaimer:***\nThis listing is for 1 metal resource token. This product is an unofficial, fan-made accessory designed to be compatible with the Flesh and Blood TCG. It is not affiliated with, endorsed by, or associated with Legend Story Studios or any of their official products. ",
    features: [
      "▶▶ Hand-Designed Detailing: Each design element was thoughtfully hand crafted by us to offer a unique, player-focused accessory.",
      "▶▶ Premium Craftsmanship: Made from high-quality metal with a polished finish, ensuring durability and a satisfying weight in hand.",
      "▶▶ Double-Sided Design: Features unique engravings on each side to represent different resource values, streamlining your gameplay.",
      "▶▶ Now available in two colourways - Fire and Ice!",
    ],
    images: {
      thumbnail: "/images/products/metal-resource-token/thumbnail.jpg.jpg",
      main: "/images/products/metal-resource-token/1.jpg.jpg",
      gallery: [
        "/images/products/metal-resource-token/1.jpg.jpg",
        "/images/products/metal-resource-token/2.jpg.webp",
        "/images/products/metal-resource-token/3.jpg.webp",
        "/images/products/metal-resource-token/4.jpg.webp",
        "/images/products/metal-resource-token/5.jpg.webp",
        "/images/products/metal-resource-token/6.jpg.webp",
        "/images/products/metal-resource-token/7.jpg.webp",
        "/images/products/metal-resource-token/8.jpg.webp",
        "/images/products/metal-resource-token/9.jpg.webp",
        "/images/products/metal-resource-token/10.jpg.jpg",
      ],
    },
    image: "/images/products/metal-resource-token/thumbnail.jpg.jpg",
    inventory: 35,
    ratings: {
      average: 4.6,
      reviews: 94,
    },
    tags: [
      "Flesh and Blood",
      "social",
      "group",
      "entertainment",
    ],
    featured: false,
    newArrival: true,
    bestseller: false,
    sku: "MG-PMP-005",
  },

  {
    id: 6,
    name: "Go Again & Dominate Metal Token",
    price: 13.99,
    category: "Flesh and Blood",
    description:
      "Fun and educational games for all ages. This set combines learning with entertainment to develop critical thinking and problem-solving skills.",
    features: [
      "6 educational games covering different subjects",
      "STEM-focused activities",
      "Progressive difficulty levels",
      "Teacher and parent guides included",
      "Ages 8-14",
    ],
    images: {
      thumbnail: "/images/products/dom-metal-token/thumbnail.jpg",
      main: "/images/products/dom-metal-token/1.jpg",
      gallery: [
        "/images/products/dom-metal-token/1.jpg",
        "/images/products/dom-metal-token/2.jpg",
        "/images/products/dom-metal-token/3.jpg",
        "/images/products/dom-metal-token/4.jpg",
        "/images/products/dom-metal-token/5.jpg",
      ],
    },
    image: "/images/products/6-educational-set/thumbnail.jpg",
    inventory: 28,
    ratings: {
      average: 4.8,
      reviews: 178,
    },
    tags: [
      "educational",
      "STEM",
      "learning",
      "children",
    ],
    featured: false,
    newArrival: false,
    bestseller: true,
    sku: "MG-EDS-006",
  },

  {
    id: 7,
    name: "20MM Sharp Resin FaB Resource Dice",
    price: 9,
    category: "Puzzles",
    description:
      "Challenging puzzle collection for puzzle enthusiasts. Features various difficulty levels and unique puzzle types to keep your mind sharp.",
    features: [
      "10 different puzzle types included",
      "Progressive difficulty from beginner to expert",
      "High-quality puzzle materials",
      "Timer and score tracking",
      "Ages 12+",
    ],
    images: {
      thumbnail: "/images/products/20mm-resin-fab/thumbnail.jpg",
      main: "/images/products/20mm-resin-fab/1.jpg",
      gallery: [
        "/images/products/20mm-resin-fab/1.jpg",
        "/images/products/20mm-resin-fab/2.jpg",
        "/images/products/20mm-resin-fab/3.jpg",
        "/images/products/20mm-resin-fab/4.jpg",
        "/images/products/20mm-resin-fab/5.jpg",
        "/images/products/20mm-resin-fab/6.jpg",
        "/images/products/20mm-resin-fab/7.jpg",
      ],
    },
    image: "/images/products/20mm-resin-fab/thumbnail.jpg",
    inventory: 31,
    ratings: {
      average: 4.7,
      reviews: 112,
    },
    tags: [
      "puzzle",
      "brain teaser",
      "logic",
      "solo",
    ],
    featured: false,
    newArrival: true,
    bestseller: false,
    sku: "MG-PMD-007",
  },

  {
    id: 8,
    name: "20MM Sharp Resin Spindown D6 Dice",
    price: 8,
    category: "Travel Games",
    description:
      "Compact and portable games perfect for travel. This collection includes magnetic and foldable games that can be played anywhere.",
    features: [
      "6 travel-friendly games",
      "Magnetic pieces to prevent loss",
      "Compact carrying case",
      "Quick gameplay (15-30 minutes)",
      "Ages 8+",
    ],
    images: {
      thumbnail: "/images/products/20mm-resin-d6/thumbnail.jpg",
      main: "/images/products/20mm-resin-d6/1.jpg",
      gallery: [
        "/images/products/20mm-resin-d6/1.jpg",
        "/images/products/20mm-resin-d6/2.jpg",
        "/images/products/20mm-resin-d6/3.jpg",
        "/images/products/20mm-resin-d6/4.jpg",
        "/images/products/20mm-resin-d6/5.jpg",
        "/images/products/20mm-resin-d6/6.jpg",
        "/images/products/20mm-resin-d6/7.jpg",
      ],
    },
    image: "/images/products/8-travel-games/thumbnail.jpg",
    inventory: 58,
    ratings: {
      average: 4.5,
      reviews: 87,
    },
    tags: [
      "travel",
      "portable",
      "magnetic",
      "compact",
    ],
    featured: false,
    newArrival: false,
    bestseller: false,
    sku: "MG-TGC-008",
  },
];

// Turn the product array into an object keyed by product ID.
// This allows secure, predictable server-side product lookups.
const productCatalog = Object.fromEntries(
  products.map((product) => [
    product.id,
    Object.freeze(product),
  ]),
);

// Read-only list used by the public products API.
export const productList = Object.freeze(
  Object.values(productCatalog),
);

/**
 * Safely retrieve a catalogue product by ID.
 *
 * @param {number|string} id Product ID
 * @returns {Object|null}
 */
export const getCatalogProductById = (id) => {
  const productId = Number.parseInt(id, 10);

  return Number.isInteger(productId)
    ? productCatalog[productId] || null
    : null;
};

// Shipping costs in AUD cents.
//
// NOTE:
// We will tighten the relationship between address country and shipping
// country when we fix the separate shipping-rate manipulation blocker.
const SHIPPING_RATES = {
  AU: 1000, // $10.00 AUD
  US: 3000, // $30.00 AUD
};

/**
 * Normalise a supplied shipping-country value.
 *
 * @param {string} country
 * @returns {"AU"|"US"}
 */
export const normalizeShippingCountry = (country) => {
  const normalized = String(country || "AU")
    .trim()
    .toUpperCase();

  return normalized === "US" ? "US" : "AU";
};

/**
 * Return shipping cost in cents.
 *
 * @param {string} country
 * @returns {number}
 */
export const getShippingCostCents = (country) => {
  return SHIPPING_RATES[
    normalizeShippingCountry(country)
  ];
};

/**
 * Calculate cart totals entirely from trusted server-side data.
 *
 * The frontend is only allowed to tell the backend:
 *
 * {
 *   id: productId,
 *   quantity: quantity
 * }
 *
 * Client-supplied product names, prices, SKUs and totals are deliberately
 * ignored.
 *
 * @param {Array} cartItems Array of { id, quantity }
 * @param {Object} options Checkout options
 * @returns {Object} Server-calculated order totals
 */
export const calculateCartTotal = (
  cartItems,
  options = {},
) => {
  if (
    !Array.isArray(cartItems) ||
    cartItems.length === 0
  ) {
    throw new Error("Cart is empty");
  }

  let subtotal = 0;
  const validatedItems = [];

  const shippingCountry =
    normalizeShippingCountry(
      options.shippingCountry,
    );

  for (const item of cartItems) {
    const product =
      getCatalogProductById(item.id);

    if (!product) {
      throw new Error(
        `Invalid product ID: ${item.id}`,
      );
    }

    const quantity = Math.max(
      1,
      Number.parseInt(
        item.quantity,
        10,
      ) || 1,
    );

    const unitPriceCents = Math.round(
      product.price * 100,
    );

    const itemTotal =
      unitPriceCents * quantity;

    subtotal += itemTotal;

    validatedItems.push({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity,
      sku: product.sku,
      total: (
        itemTotal / 100
      ).toFixed(2),
    });
  }

  const shippingCost =
    getShippingCostCents(
      shippingCountry,
    );

  const total =
    subtotal + shippingCost;

  return {
    subtotal: (
      subtotal / 100
    ).toFixed(2),

    shipping: (
      shippingCost / 100
    ).toFixed(2),

    total: (
      total / 100
    ).toFixed(2),

    totalCents: total,

    currency: "AUD",

    shippingCountry,

    items: validatedItems,
  };
};

export default productCatalog;