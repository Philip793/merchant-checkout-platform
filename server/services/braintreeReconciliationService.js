import gateway from "../config/braintree.js";
import { classifyBraintreeTransaction } from "./braintreeStatus.js";
import { finalizeBraintreePendingOrder } from "../controllers/braintreeController.js";
import { releaseInventory } from "./inventoryService.js";
import { sendOrderConfirmationEmailOnce, sendMerchantOrderNotificationEmailOnce } from "./emailService.js";

// Braintree's transaction search is a stream, not a promise.
const searchByOrderId = (orderId) => new Promise((resolve, reject) => {
  const found = [];
  const stream = gateway.transaction.search((query) => query.orderId().is(orderId));
  stream.on("data", (transaction) => found.push(transaction));
  stream.on("error", reject);
  stream.on("end", () => resolve(found));
});

export const reconcileBraintreeProcessingOrder = async (pending) => {
  if (pending.paymentProvider !== "braintree" || pending.paymentState !== "processing") {
    return { skipped: true };
  }
  // A transaction search may lag behind a recent sale. No result NEVER means
  // no charge: retain the stock reservation for manual investigation.
  const found = pending.braintreeTransactionId
    ? [await gateway.transaction.find(pending.braintreeTransactionId)]
    : await searchByOrderId(pending._id.toString());

  if (found.length !== 1) return { uncertain: true, reason: `Found ${found.length} provider transactions` };
  const transaction = found[0];
  if (transaction.orderId !== pending._id.toString() ||
      Math.round(Number(transaction.amount) * 100) !== Math.round(pending.total * 100) ||
      (transaction.currencyIsoCode && transaction.currencyIsoCode.toUpperCase() !== pending.currency)) {
    return { uncertain: true, reason: "Provider transaction identity or amount mismatch" };
  }

  const classification = classifyBraintreeTransaction(transaction.status);
  if (classification === "uncertain") return { uncertain: true, reason: `Provider state ${transaction.status}` };

  if (classification === "paid") {
    pending.braintreeTransactionId = transaction.id;
    pending.paymentState = "succeeded";
    pending.paymentCompletedAt = pending.paymentCompletedAt || new Date();
    await pending.save();
    const { order } = await finalizeBraintreePendingOrder(pending);
    await sendOrderConfirmationEmailOnce(order);
    await sendMerchantOrderNotificationEmailOnce(order);
    return { recovered: true, orderId: order.orderId };
  }

  // Only an explicitly terminal provider failure permits stock release.
  const inventoryResult = await releaseInventory(
    pending.items.map((item) => ({ id: item.productId, quantity: item.quantity })),
    pending.inventoryReservationId,
  );
  if (!inventoryResult.success) throw new Error("Inventory release was not confirmed");
  pending.paymentState = "failed";
  pending.status = "failed";
  pending.inventoryStatus = "released";
  pending.failureReason = `Braintree ${transaction.status}`;
  await pending.save();
  return { failed: true };
};
