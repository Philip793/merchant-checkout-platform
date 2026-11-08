// Run as a SEPARATE Railway cron service every five minutes:
// npm run reconcile
// This process never listens on an HTTP port.
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import PendingOrder from "../models/PendingOrder.js";
import Order from "../models/Order.js";
import { releaseInventory } from "../services/inventoryService.js";
import { releaseExpiredPendingOrders } from "../controllers/stripeController.js";
import {
  sendOrderConfirmationEmailOnce,
  sendMerchantOrderNotificationEmailOnce,
} from "../services/emailService.js";

const run = async () => {
  await connectDB();
  await releaseExpiredPendingOrders();

  // Braintree paymentState=processing is intentionally excluded: a sale
  // might have been accepted by the provider despite a network failure.
  const expired = await PendingOrder.find({
    paymentProvider: "braintree", status: "pending",
    paymentState: "not_started", inventoryStatus: "reserved",
    expiresAt: { $lte: new Date() },
    inventoryReservationId: { $exists: true, $type: "string", $ne: "" },
  }).limit(100);
  for (const pending of expired) {
    try {
      const result = await releaseInventory(
        pending.items.map((i) => ({ id: i.productId, quantity: i.quantity })),
        pending.inventoryReservationId,
      );
      if (!result.success) throw new Error("Inventory release unsuccessful");
      pending.inventoryStatus = "released";
      pending.status = "expired";
      await pending.save();
    } catch (error) {
      console.error("Braintree expiry reconciliation failed", {
        pendingOrderId: pending.id, error: error.message,
      });
    }
  }

  const orders = await Order.find({
    $or: [
      { "email.confirmationSentAt": { $exists: false } },
      { "email.merchantSentAt": { $exists: false } },
    ],
  }).sort({ createdAt: -1 }).limit(100);
  for (const order of orders) {
    await sendOrderConfirmationEmailOnce(order);
    await sendMerchantOrderNotificationEmailOnce(order);
  }
  console.log("Reconciliation finished", { braintreeExpired: expired.length, emailsChecked: orders.length });
};

run().catch((error) => {
  console.error("Reconciliation failed", error);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect();
});
