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
import { finalizePendingOrder } from "../controllers/stripeController.js";
import stripe from "../config/stripe.js";
import { finalizeBraintreePendingOrder } from "../controllers/braintreeController.js";
import { reconcileBraintreeProcessingOrder } from "../services/braintreeReconciliationService.js";
import {
  sendOrderConfirmationEmailOnce,
  sendMerchantOrderNotificationEmailOnce,
  sendPaymentReconciliationAlertOnce,
} from "../services/emailService.js";

const run = async () => {
  await connectDB();
  await releaseExpiredPendingOrders();

  // Braintree paymentState=processing is intentionally excluded: a sale
  // might have been accepted by the provider despite a network failure.
  const expired = await PendingOrder.find({
    paymentProvider: "braintree", status: { $in: ["pending", "expired"] },
    paymentState: "not_started", inventoryStatus: "reserved",
    expiresAt: { $lte: new Date() },
    inventoryReservationId: { $exists: true, $type: "string", $ne: "" },
  }).limit(100);
  for (const pending of expired) {
    try {
      const claimed = pending.status === "expired" ? pending : await PendingOrder.findOneAndUpdate(
        { _id: pending._id, status: "pending", paymentState: "not_started", inventoryStatus: "reserved", expiresAt: { $lte: new Date() } },
        { $set: { status: "expired" } },
        { new: true },
      );
      if (!claimed) continue;
      const result = await releaseInventory(
        claimed.items.map((i) => ({ id: i.productId, quantity: i.quantity })),
        claimed.inventoryReservationId,
      );
      if (!result.success) throw new Error("Inventory release unsuccessful");
      claimed.inventoryStatus = "released";
      await claimed.save();
    } catch (error) {
      console.error("Braintree expiry reconciliation failed", {
        pendingOrderId: pending.id, error: error.message,
      });
    }
  }

  // Reconcile provider calls interrupted after an attempt was recorded.
  // Never charge again, and never infer failure from a missing search result.
  const braintreeProcessing = await PendingOrder.find({
    paymentProvider: "braintree", paymentState: "processing",
    paymentAttemptedAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) },
  }).limit(50);
  for (const pending of braintreeProcessing) {
    try {
      const result = await reconcileBraintreeProcessingOrder(pending);
      if (result.uncertain) {
        console.error("MANUAL PAYMENT REVIEW REQUIRED", {
          pendingOrderId: pending.id, reason: result.reason,
        });
        if (pending.paymentAttemptedAt < new Date(Date.now() - 30 * 60 * 1000)) {
          await sendPaymentReconciliationAlertOnce(pending, result.reason);
        }
      }
    } catch (error) {
      console.error("MANUAL PAYMENT REVIEW REQUIRED", { pendingOrderId: pending.id, error: error.message });
    }
  }

  // A successful payment might have been recorded without completing stock
  // confirmation. Recover from the provider, without a second charge.
  const incomplete = await PendingOrder.find({
    inventoryStatus: "reserved",
    $or: [{ paymentState: "succeeded" }, { status: "paid" }],
  }).limit(50);
  for (const pending of incomplete) {
    try {
      if (pending.paymentProvider === "braintree" && pending.braintreeTransactionId) {
        await finalizeBraintreePendingOrder(pending);
      } else if (pending.paymentProvider === "stripe" && pending.stripePaymentIntentId) {
        const intent = await stripe.paymentIntents.retrieve(pending.stripePaymentIntentId);
        if (intent.status === "succeeded") await finalizePendingOrder(pending, intent);
      }
    } catch (error) {
      console.error("PAID ORDER REQUIRES STOCK REVIEW", { pendingOrderId: pending.id, error: error.message });
    }
  }

  // Explicit cutoff prevents old test/historical orders from being emailed
  // when this job is enabled for the first time.
  const retrySince = process.env.EMAIL_RETRY_SINCE;
  if (!retrySince || !Number.isFinite(Date.parse(retrySince))) {
    throw new Error("EMAIL_RETRY_SINCE must be set to an ISO UTC timestamp before starting the reconciliation job");
  }
  const orders = await Order.find({
    createdAt: { $gte: new Date(retrySince) },
    $or: [
      { "email.confirmationSentAt": { $exists: false } },
      { "email.merchantSentAt": { $exists: false } },
    ],
  }).sort({ createdAt: -1 }).limit(100);
  for (const order of orders) {
    await sendOrderConfirmationEmailOnce(order);
    await sendMerchantOrderNotificationEmailOnce(order);
  }
  console.log("Reconciliation finished", {
    braintreeExpired: expired.length, braintreeProcessing: braintreeProcessing.length,
    incompletePaid: incomplete.length, emailsChecked: orders.length,
  });
};

run().catch((error) => {
  console.error("Reconciliation failed", error);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect();
});
