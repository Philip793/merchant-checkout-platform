import Inventory from "../models/Inventory.js";
import {
  productList,
  getCatalogProductById,
} from "../data/productCatalog.js";

/**
 * Convert an authoritative catalogue product into the shape
 * returned to the frontend.
 *
 * Product identity and price come only from productCatalog.js.
 * Current stock comes from MongoDB.
 *
 * @param {Object} product
 * @param {Object|null} inventory
 * @returns {Object}
 */
const toPublicProduct = (product, inventory) => ({
  ...product,

  // Inventory is dynamic operational data.
  // Do not use the static catalogue inventory value as current stock.
  inventory: {
    inStock: Boolean(
      inventory &&
        inventory.availableStock > 0,
    ),

    quantity:
      inventory?.availableStock ?? 0,

    sku: product.sku,
  },
});

/**
 * GET /products
 *
 * Returns the full public product catalogue.
 *
 * Names, prices, descriptions, images and SKUs come from the
 * authoritative server-side product catalogue.
 *
 * Current available stock comes from MongoDB.
 */
export const getProducts = async (
  req,
  res,
  next,
) => {
  try {
    // Retrieve inventory only for products that exist
    // in the authoritative catalogue.
    const inventoryRows =
      await Inventory.find({
        productId: {
          $in: productList.map(
            (product) => product.id,
          ),
        },
      })
        .select(
          "productId availableStock",
        )
        .lean();

    // Create a lookup table so we do not need to make
    // one MongoDB query per product.
    const inventoryByProductId =
      new Map(
        inventoryRows.map((row) => [
          row.productId,
          row,
        ]),
      );

    // Combine catalogue information with current stock.
    const products =
      productList.map((product) =>
        toPublicProduct(
          product,
          inventoryByProductId.get(
            product.id,
          ),
        ),
      );

    return res
      .status(200)
      .json({ products });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /products/:productId
 *
 * Returns one public product by ID.
 */
export const getProduct = async (
  req,
  res,
  next,
) => {
  try {
    const product =
      getCatalogProductById(
        req.params.productId,
      );

    if (!product) {
      return res
        .status(404)
        .json({
          error: "Product not found",
        });
    }

    // Current stock still comes from MongoDB.
    const inventory =
      await Inventory.findOne({
        productId: product.id,
      })
        .select(
          "productId availableStock",
        )
        .lean();

    return res
      .status(200)
      .json({
        product: toPublicProduct(
          product,
          inventory,
        ),
      });
  } catch (error) {
    return next(error);
  }
};