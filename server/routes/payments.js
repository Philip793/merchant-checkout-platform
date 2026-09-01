import express from "express";
import {
  createCheckoutSession,
  confirmPayment,
} from "../controllers/stripeController.js";
import {
  getClientToken,
  checkoutWithCart,
} from "../controllers/braintreeController.js";
import {
  getOrders,
  getOrderById,
  updateOrderStatus,
  getOrderStats,
} from "../controllers/orderController.js";
import {
  register,
  login,
  getMe,
  logout,
  updateShippingAddress,
} from "../controllers/authController.js";
import {
  authenticate,
  requireAdmin,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Auth routes
router.post("/auth/register", register);
router.post("/auth/login", login);
router.get("/auth/me", authenticate, getMe);
router.patch("/auth/shipping-address", authenticate, updateShippingAddress);
router.post("/auth/logout", authenticate, logout);

// Stripe routes - Secure endpoints only (calculate totals server-side)
router.post("/create-checkout-session", authenticate, createCheckoutSession);
router.post("/confirm-payment", confirmPayment);

// Braintree routes - Secure endpoints only (calculate totals server-side)
router.get(
  "/braintree/token",
  authenticate,
  getClientToken,
);
router.post(
  "/braintree/checkout-with-cart",
  authenticate,
  checkoutWithCart,
);

// Order routes - admin only for list/all, optional auth for single order
router.get("/orders", authenticate, requireAdmin, getOrders);
router.get("/orders/stats", authenticate, requireAdmin, getOrderStats);
router.get("/orders/:orderId", authenticate, getOrderById);
router.patch(
  "/orders/:orderId/status",
  authenticate,
  requireAdmin,
  updateOrderStatus,
);

export default router;
