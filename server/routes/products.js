import express from "express";

import {
  getProducts,
  getProduct,
} from "../controllers/productController.js";

const router = express.Router();

/**
 * Public product catalogue routes.
 *
 * These routes are read-only and intentionally public because
 * customers need to browse products before logging in.
 */

// GET /products
router.get("/", getProducts);

// GET /products/:productId
router.get("/:productId", getProduct);

export default router;