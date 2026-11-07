import Inventory from "../models/Inventory.js";
import productCatalog from "../data/productCatalog.js";

/**
 * Initialize inventory from product catalog
 * Syncs catalog data to MongoDB on server startup
 */
export const initializeInventory = async () => {
  try {
    const count = await Inventory.syncFromCatalog(productCatalog);
    console.log(
      `📦 Inventory initialized: ${count} products synced to MongoDB`,
    );
    return count;
  } catch (error) {
    console.error("❌ Failed to initialize inventory:", error.message);
    throw error;
  }
};

/**
 * Check if there is sufficient inventory for all items in cart
 * ATOMIC: Reads from MongoDB with current available stock
 * @param {Array} cartItems - Array of {id, quantity}
 * @returns {Object} - { available: boolean, insufficientItems: [] }
 */
export const checkInventory = async (cartItems) => {
  const insufficientItems = [];

  for (const item of cartItems) {
    const inventory = await Inventory.findOne({ productId: item.id });

    if (!inventory) {
      insufficientItems.push({
        productId: item.id,
        requested: item.quantity,
        available: 0,
        reason: "Product not found in inventory",
      });
      continue;
    }

    if (inventory.availableStock < item.quantity) {
      insufficientItems.push({
        productId: item.id,
        productName: inventory.name,
        requested: item.quantity,
        available: inventory.availableStock,
        reason: "Insufficient stock",
      });
    }
  }

  return {
    available: insufficientItems.length === 0,
    insufficientItems,
  };
};

/**
 * Reserve inventory for an order (before payment)
 * ATOMIC: Uses findOneAndUpdate to prevent race conditions
 * @param {Array} cartItems - Array of {id, quantity}
 * @returns {Object} - { success: boolean, reservations: [], errors: [] }
 */
const validateReservationRequest = (cartItems, reservationId) => {
  if (!reservationId || typeof reservationId !== "string") {
    throw new Error("A checkout reservation ID is required");
  }
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error("A non-empty inventory cart is required");
  }
  const seen = new Set();
  for (const item of cartItems) {
    if (!Number.isInteger(item.id) || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error("Invalid inventory product ID or quantity");
    }
    if (seen.has(item.id)) {
      throw new Error(`Duplicate product ${item.id} in inventory cart`);
    }
    seen.add(item.id);
  }
};

export const reserveInventory = async (cartItems, reservationId, expiresAt) => {
  validateReservationRequest(cartItems, reservationId);
  if (!(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) {
    throw new Error("A future reservation expiry is required");
  }
  const reservations = [];
  const errors = [];

  for (const item of cartItems) {
    try {
      const result = await Inventory.reserveForCheckout({
        productId: item.id,
        quantity: item.quantity,
        reservationId,
        expiresAt,
      });
      if (!result.success) {
        errors.push({ productId: item.id, reason: result.reason || "Insufficient stock" });
        break;
      }
      reservations.push({
        productId: item.id,
        productName: result.inventory.name,
        reserved: item.quantity,
        remaining: result.inventory.availableStock,
        alreadyReserved: Boolean(result.alreadyReserved),
      });
    } catch (error) {
      errors.push({ productId: item.id, reason: error.message });
      break;
    }
  }

  // Roll back only reservations created by THIS call, never a prior retry.
  if (errors.length > 0 && reservations.length > 0) {
    for (const reservation of reservations.filter((item) => !item.alreadyReserved)) {
      try {
        const released = await Inventory.releaseReservation({
          productId: reservation.productId,
          quantity: reservation.reserved,
          reservationId,
        });
        if (!released.success) {
          errors.push({ productId: reservation.productId, reason: `Rollback failed: ${released.reason}` });
        }
      } catch (error) {
        errors.push({ productId: reservation.productId, reason: `Rollback failed: ${error.message}` });
      }
    }
  }

  return {
    success: errors.length === 0,
    reservations,
    errors,
  };
};

/**
 * Confirm reservation (convert to actual sale after payment)
 * ATOMIC: Uses findOneAndUpdate to deduct from total stock
 * @param {Array} cartItems - Array of {id, quantity}
 * @returns {Object} - { success: boolean, updatedProducts: [], errors: [] }
 */
export const confirmInventory = async (cartItems, reservationId) => {
  validateReservationRequest(cartItems, reservationId);
  const updatedProducts = [];
  const errors = [];

  for (const item of cartItems) {
    try {
      const result = await Inventory.confirmReservation({
        productId: item.id, quantity: item.quantity, reservationId,
      });
      if (!result.success) {
        errors.push(`Product ${item.id}: ${result.reason}`);
        continue;
      }
      updatedProducts.push({
        id: item.id,
        name: result.inventory.name,
        sold: item.quantity,
        remaining: result.inventory.totalStock,
        alreadyConfirmed: Boolean(result.alreadyConfirmed),
      });
    } catch (error) {
      errors.push(`Product ${item.id}: ${error.message}`);
    }
  }

  return {
    success: errors.length === 0,
    updatedProducts,
    errors,
  };
};

/**
 * Release reserved inventory for an unpaid/failed order.
 * ATOMIC: Moves stock from reserved back to available without changing total.
 * @param {Array} cartItems - Array of {id, quantity}
 * @returns {Object} - { success: boolean, releasedProducts: [], errors: [] }
 */
export const releaseInventory = async (cartItems, reservationId) => {
  validateReservationRequest(cartItems, reservationId);
  const releasedProducts = [];
  const errors = [];

  for (const item of cartItems) {
    try {
      const result = await Inventory.releaseReservation({
        productId: item.id, quantity: item.quantity, reservationId,
      });
      if (!result.success) {
        errors.push(`Product ${item.id}: ${result.reason}`);
        continue;
      }
      releasedProducts.push({
        id: item.id,
        name: result.inventory.name,
        released: item.quantity,
        available: result.inventory.availableStock,
        alreadyReleased: Boolean(result.alreadyReleased),
      });
    } catch (error) {
      errors.push(`Product ${item.id}: ${error.message}`);
    }
  }

  return {
    success: errors.length === 0,
    releasedProducts,
    errors,
  };
};

/**
 * Reduce inventory after successful order (legacy wrapper)
 * Now uses atomic confirm operation
 * @param {Array} cartItems - Array of {id, quantity}
 * @returns {Object} - { success: boolean, updatedProducts: [], errors: [] }
 */
export const reduceInventory = async (cartItems) => {
  // For direct reduction (no reservation), we atomically decrement
  const updatedProducts = [];
  const errors = [];

  for (const item of cartItems) {
    const result = await Inventory.findOneAndUpdate(
      {
        productId: item.id,
        availableStock: { $gte: item.quantity },
      },
      {
        $inc: {
          totalStock: -item.quantity,
          availableStock: -item.quantity,
        },
        $set: { lastSync: new Date() },
      },
      { new: true },
    );

    if (!result) {
      const inventory = await Inventory.findOne({ productId: item.id });
      errors.push({
        productId: item.id,
        productName: inventory?.name || "Unknown",
        requested: item.quantity,
        available: inventory?.availableStock || 0,
        reason: "Insufficient stock for atomic decrement",
      });
    } else {
      updatedProducts.push({
        id: item.id,
        name: result.name,
        newInventory: result.totalStock,
        reducedBy: item.quantity,
      });

      console.log(
        `📦 Inventory reduced: ${result.name} - ${item.quantity} units (total: ${result.totalStock})`,
      );
    }
  }

  return {
    success: errors.length === 0,
    updatedProducts,
    errors,
  };
};

/**
 * Restore inventory (for cancelled orders or returns)
 * ATOMIC: Increments both total and available stock
 * @param {Array} cartItems - Array of {id, quantity}
 * @returns {Object} - { success: boolean, restoredProducts: [], errors: [] }
 */
export const restoreInventory = async (cartItems) => {
  const restoredProducts = [];
  const errors = [];

  for (const item of cartItems) {
    const result = await Inventory.findOneAndUpdate(
      { productId: item.id },
      {
        $inc: {
          totalStock: item.quantity,
          availableStock: item.quantity,
        },
        $set: { lastSync: new Date() },
      },
      { new: true },
    );

    if (!result) {
      errors.push(`Product ${item.id} not found in inventory`);
    } else {
      restoredProducts.push({
        id: item.id,
        name: result.name,
        newInventory: result.totalStock,
        restoredBy: item.quantity,
      });

      console.log(
        `📦 Inventory restored: ${result.name} + ${item.quantity} units (total: ${result.totalStock})`,
      );
    }
  }

  return {
    success: errors.length === 0,
    restoredProducts,
    errors,
  };
};

/**
 * Get current inventory for a product
 * @param {number} productId
 * @returns {number} - Current available inventory count
 */
export const getInventory = async (productId) => {
  const inventory = await Inventory.findOne({ productId });
  return inventory ? inventory.availableStock : 0;
};

/**
 * Get low stock products (below threshold)
 * @param {number} threshold - Inventory threshold (default: 10)
 * @returns {Array} - Products with low inventory
 */
export const getLowStockProducts = async (threshold = 10) => {
  const lowStock = await Inventory.find({
    availableStock: { $lte: threshold },
  })
    .sort({ availableStock: 1 })
    .lean();

  return lowStock.map((item) => ({
    id: item.productId,
    name: item.name,
    inventory: item.availableStock,
    total: item.totalStock,
    reserved: item.reservedStock,
    sku: item.sku,
  }));
};

/**
 * Get full inventory status for all products
 * @returns {Array} - All inventory records
 */
export const getAllInventory = async () => {
  const inventory = await Inventory.find().lean();
  return inventory.map((item) => ({
    id: item.productId,
    name: item.name,
    sku: item.sku,
    total: item.totalStock,
    available: item.availableStock,
    reserved: item.reservedStock,
    isLowStock: item.availableStock <= item.lowStockThreshold,
  }));
};

export default {
  initializeInventory,
  checkInventory,
  reserveInventory,
  confirmInventory,
  releaseInventory,
  reduceInventory,
  restoreInventory,
  getInventory,
  getLowStockProducts,
  getAllInventory,
};
