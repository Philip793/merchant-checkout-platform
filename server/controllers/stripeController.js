import stripe from "../config/stripe.js";
import { verifyCheckoutQuote } from "../services/checkoutQuoteService.js";
import { v4 as uuidv4 } from "uuid";
import {
  calculateCartTotal,
} from "../data/productCatalog.js";

import Order from "../models/Order.js";
import PendingOrder from "../models/PendingOrder.js";

import {
  createOrder,
} from "./orderController.js";

import {
  reserveInventory,
  confirmInventory,
  releaseInventory,
} from "../services/inventoryService.js";

import {
  sendOrderConfirmationEmailOnce,
  sendMerchantOrderNotificationEmailOnce,
} from "../services/emailService.js";

const PENDING_ORDER_TTL_MINUTES = 30;

const toNumber = (value) =>
  Number.parseFloat(value);

const countryName = (country) =>
  String(country || "").toUpperCase() ===
  "US"
    ? "United States"
    : "Australia";

const buildPendingOrderItems = (
  orderSummary,
) => {
  return orderSummary.items.map(
    (item) => ({
      productId: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      sku:
        item.sku ||
        `SKU-${item.id}`,
    }),
  );
};

const buildInventoryItems = (
  pendingOrder,
) => {
  return pendingOrder.items.map(
    (item) => ({
      id: item.productId,
      quantity: item.quantity,
    }),
  );
};

const releasePendingInventory =
  async (pendingOrder) => {
    if (
      !pendingOrder ||
      pendingOrder.inventoryStatus !==
        "reserved"
    ) {
      return {
        success: true,
        skipped: true,
      };
    }

    const inventoryResult =
      await releaseInventory(
        buildInventoryItems(
          pendingOrder,
        ),
        pendingOrder.inventoryReservationId,
      );

    if (inventoryResult.success) {
      pendingOrder.inventoryStatus =
        "released";

      await pendingOrder.save();
    }

    return inventoryResult;
  };

export const releaseExpiredPendingOrders =
  async () => {
    const expiredOrders =
      await PendingOrder.find({
        status: "pending",
        inventoryStatus:
          "reserved",
        expiresAt: {
          $lte: new Date(),
        },
        // Legacy checkouts were created before per-checkout reservation
        // IDs existed. They must be reconciled separately; attempting to
        // release them through the new inventory API would throw.
        inventoryReservationId: {
          $exists: true,
          $type: "string",
          $ne: "",
        },
      }).limit(50);

    for (const pendingOrder of expiredOrders) {
      try {
        if (pendingOrder.stripePaymentIntentId) {
          // Do not release stock merely because our local timer elapsed.
          // The payment provider is authoritative about payment status.
          const paymentIntent = await stripe.paymentIntents.retrieve(
            pendingOrder.stripePaymentIntentId,
          );

          if (paymentIntent.status === "succeeded") {
            const order = await finalizePendingOrder(pendingOrder, paymentIntent);
            await sendOrderConfirmationEmailOnce(order);
            await sendMerchantOrderNotificationEmailOnce(order);
            continue;
          }

          if (paymentIntent.status !== "canceled") {
            // A pending/authorized payment may still settle. Keep its stock
            // reserved until a separate reconciliation flow resolves it.
            const cancellable = [
              "requires_payment_method",
              "requires_confirmation",
              "requires_action",
            ];
            if (!cancellable.includes(paymentIntent.status)) {
              console.warn("Expired Stripe checkout requires reconciliation", {
                pendingOrderId: pendingOrder._id.toString(),
                paymentIntentId: paymentIntent.id,
                paymentStatus: paymentIntent.status,
              });
              continue;
            }

            // Cancel at Stripe FIRST. Never release reserved stock while
            // its payment intent could still accept a payment.
            const cancelled = await stripe.paymentIntents.cancel(paymentIntent.id);
            if (cancelled.status !== "canceled") {
              throw new Error("Stripe did not confirm payment cancellation");
            }
          }
        }

        const inventoryResult = await releasePendingInventory(pendingOrder);
        if (!inventoryResult.success) {
          throw new Error(`Inventory release failed: ${JSON.stringify(inventoryResult.errors)}`);
        }

        pendingOrder.status = "expired";
        await pendingOrder.save();
      } catch (error) {
        // One old or temporarily failing checkout must not block all new
        // Stripe checkouts. Keep the reserved state for later reconciliation.
        console.error("Expired Stripe checkout reconciliation failed", {
          pendingOrderId: pendingOrder._id.toString(),
          error: error.message,
        });
      }
    }
  };

/*
 * Convert a successful Stripe payment
 * into a permanent order.
 *
 * SECURITY:
 * Ownership comes exclusively from the
 * authenticated user's PendingOrder.
 */
export const finalizePendingOrder = async (
  pendingOrder,
  paymentIntent,
) => {
  /*
   * Fail closed if an old or malformed
   * pending order has no account owner.
   */
  if (!pendingOrder.userId) {
    throw new Error(
      `Pending order ${pendingOrder._id} is missing user ownership`,
    );
  }

  /*
   * Stripe webhook retries are normal.
   * If this payment has already produced
   * an order, reuse it.
   */
  const existingOrder =
    await Order.findOne({
      "payment.transactionId":
        paymentIntent.id,
    });

  if (existingOrder) {
    pendingOrder.status = "paid";
    pendingOrder.paymentState = "succeeded";
    pendingOrder.paymentCompletedAt = pendingOrder.paymentCompletedAt || new Date();

    pendingOrder.finalizedOrderId =
      existingOrder.orderId;

    if (
      pendingOrder.inventoryStatus ===
      "reserved"
    ) {
      const inventoryResult =
        await confirmInventory(
          buildInventoryItems(
            pendingOrder,
          ),
          pendingOrder.inventoryReservationId,
        );

      if (inventoryResult.success) {
        pendingOrder.inventoryStatus =
          "confirmed";
      }
    }

    await pendingOrder.save();

    return existingOrder;
  }

  /*
   * Never create an order if Stripe's
   * successful payment amount does not
   * match the server-calculated amount.
   */
  if (
    paymentIntent.amount !==
    Math.round(
      pendingOrder.total * 100,
    )
  ) {
    throw new Error(
      `Payment amount mismatch for ${paymentIntent.id}: ` +
        `Stripe ${paymentIntent.amount}, pending ${Math.round(
          pendingOrder.total * 100,
        )}`,
    );
  }

  const orderData = {
    /*
     * CRITICAL:
     * Permanent ownership is inherited
     * from the PendingOrder.
     *
     * Never use customer.email or a
     * client-provided user id here.
     */
    userId: pendingOrder.userId,

    items: pendingOrder.items.map(
      (item) => ({
        productId:
          item.productId,

        name: item.name,

        price: item.price,

        quantity:
          item.quantity,

        sku: item.sku,
      }),
    ),

    subtotal:
      pendingOrder.subtotal,

    shipping:
      pendingOrder.shipping,

    total: pendingOrder.total,

    currency:
      pendingOrder.currency,

    payment: {
      provider: "stripe",

      transactionId:
        paymentIntent.id,

      status: "completed",

      paidAt: new Date(),
    },

    status: "pending",

    customer:
      pendingOrder.customer || {},

    shippingAddress: {
      ...(pendingOrder.shippingAddress ||
        {}),

      country: countryName(
        pendingOrder.shippingCountry,
      ),
    },

    metadata: {
      pendingOrderId:
        pendingOrder._id.toString(),

      stripePaymentIntentId:
        paymentIntent.id,

      shippingCountry:
        pendingOrder.shippingCountry,
      exchangeRate: String(pendingOrder.exchangeRate || ""),
      exchangeRateDate: pendingOrder.exchangeRateDate || "",
      shippingOriginal: pendingOrder.shippingOriginal || "",
    },
  };

  const order = await createOrder(
    orderData,
    {
      throwOnError: true,
    },
  );

  const inventoryResult =
    await confirmInventory(
      buildInventoryItems(
        pendingOrder,
      ),
      pendingOrder.inventoryReservationId,
    );

  if (!inventoryResult.success) {
    throw new Error(
      `Inventory confirmation failed for ${paymentIntent.id}: ` +
        `${JSON.stringify(
          inventoryResult.errors,
        )}`,
    );
  }

  pendingOrder.status = "paid";
  pendingOrder.paymentState = "succeeded";
  pendingOrder.paymentCompletedAt = pendingOrder.paymentCompletedAt || new Date();

  pendingOrder.inventoryStatus =
    "confirmed";

  pendingOrder.finalizedOrderId =
    order.orderId;

  await pendingOrder.save();

  return order;
};

/**
 * Create a secure Stripe checkout.
 *
 * The authenticated user's MongoDB id is
 * persisted as the owner of the pending
 * order before Stripe receives payment.
 */
export const createCheckoutSession =
  async (req, res) => {
    let pendingOrder = null;
    let createdPaymentIntentId = null;

    let reservedItems = [];
    const reservationId = uuidv4();
    const reservationExpiresAt = new Date(
      Date.now() + PENDING_ORDER_TTL_MINUTES * 60 * 1000,
    );

    try {
      /*
       * This comes from the verified JWT,
       * not from req.body.
       */
      const authenticatedUserId =
        req.user?.userId;

      if (!authenticatedUserId) {
        return res
          .status(401)
          .send({
            error:
              "Your login session is outdated. Please log out and log in again.",
          });
      }

      const {
  cartItems,
  customer = {},
  shippingAddress = {},
  quoteToken,
  idempotencyKey,
} = req.body;

      if (typeof idempotencyKey !== "string" || !/^st-[a-zA-Z0-9-]{20,190}$/.test(idempotencyKey)) {
        return res.status(400).json({ error: "A valid Stripe checkout attempt ID is required" });
      }

      if (
        !cartItems ||
        !Array.isArray(cartItems) ||
        cartItems.length === 0
      ) {
        return res
          .status(400)
          .send({
            error:
              "Invalid or empty cart",
          });
      }

      await releaseExpiredPendingOrders();

      const prior = await PendingOrder.findOne({
        userId: authenticatedUserId,
        paymentProvider: "stripe",
        idempotencyKey,
      });
      if (prior) {
        if (prior.status === "pending" && prior.expiresAt > new Date() && prior.stripePaymentIntentId) {
          const oldIntent = await stripe.paymentIntents.retrieve(prior.stripePaymentIntentId);
          if (["requires_payment_method", "requires_confirmation", "requires_action"].includes(oldIntent.status)) {
            return res.json({
              clientSecret: oldIntent.client_secret,
              paymentIntentId: oldIntent.id,
              pendingOrderId: prior._id.toString(),
              orderSummary: {
                items: prior.items.map((i) => ({ id: i.productId, name: i.name, price: i.price,
                  quantity: i.quantity, total: (i.price * i.quantity).toFixed(2), sku: i.sku })),
                subtotal: prior.subtotal.toFixed(2), shipping: prior.shipping.toFixed(2),
                total: prior.total.toFixed(2), currency: "AUD", shippingCountry: prior.shippingCountry,
                exchangeRate: prior.exchangeRate, exchangeRateDate: prior.exchangeRateDate,
                shippingOriginal: prior.shippingOriginal,
              },
              reused: true,
            });
          }
        }
        return res.status(409).json({ error: "This checkout attempt was already processed or expired. Please start a fresh checkout." });
      }

      const orderSummary = verifyCheckoutQuote({
        quoteToken, cartItems, shippingAddress, userId: authenticatedUserId,
      });

      const inventoryItems =
        orderSummary.items.map(
          (item) => ({
            id: item.id,
            quantity:
              item.quantity,
          }),
        );

      const reservation =
        await reserveInventory(
          inventoryItems,
          reservationId,
          reservationExpiresAt,
        );

      if (!reservation.success) {
        return res
          .status(400)
          .send({
            error:
              "Insufficient inventory",

            details:
              reservation.errors,
          });
      }

      reservedItems =
        inventoryItems;

      /*
       * CRITICAL OWNERSHIP WRITE:
       *
       * userId comes only from the
       * authenticated JWT.
       */
      pendingOrder =
        await PendingOrder.create({
          userId:
            authenticatedUserId,

          paymentProvider: "stripe",
          idempotencyKey,

          items:
            buildPendingOrderItems(
              orderSummary,
            ),

          subtotal:
            toNumber(
              orderSummary.subtotal,
            ),

          shipping:
            toNumber(
              orderSummary.shipping,
            ),

          total:
            toNumber(
              orderSummary.total,
            ),

          currency: "AUD",

          shippingCountry:
            orderSummary.shippingCountry,
          exchangeRate: orderSummary.exchangeRate,
          exchangeRateDate: orderSummary.exchangeRateDate,
          shippingOriginal: orderSummary.shippingOriginal,

          customer: {
            email: req.user.email,
            name: String(shippingAddress.fullName || req.user.name || "Customer").slice(0, 100),
          },

          shippingAddress: {
            ...shippingAddress,

            country: countryName(
              orderSummary.shippingCountry,
            ),
          },

          inventoryStatus:
            "reserved",

          inventoryReservationId: reservationId,

          expiresAt: reservationExpiresAt,
        });

      const paymentIntent =
        await stripe.paymentIntents.create(
          {
            amount:
              orderSummary.totalCents,

            currency: "aud",

            automatic_payment_methods:
              {
                enabled: true,
              },

            metadata: {
              pendingOrderId:
                pendingOrder._id.toString(),

              shippingCountry:
                orderSummary.shippingCountry,
            },
          },
          { idempotencyKey: `stripe-${pendingOrder._id.toString()}` },
        );
      createdPaymentIntentId = paymentIntent.id;

      pendingOrder.stripePaymentIntentId =
        paymentIntent.id;

      await pendingOrder.save();

      res.send({
        clientSecret:
          paymentIntent.client_secret,

        paymentIntentId:
          paymentIntent.id,

        pendingOrderId:
          pendingOrder._id.toString(),

        orderSummary,
      });
    } catch (err) {
      console.error(
        "Checkout error:",
        err,
      );

      if (createdPaymentIntentId) {
        try {
          const cancelled = await stripe.paymentIntents.cancel(createdPaymentIntentId);
          if (cancelled.status !== "canceled") throw new Error("Stripe cancellation not confirmed");
        } catch (cancelError) {
          console.error("Checkout payment intent needs manual reconciliation", {
            paymentIntentId: createdPaymentIntentId, error: cancelError.message,
          });
          return res.status(503).json({ error: "Checkout status is uncertain. Do not retry payment; contact support." });
        }
      }

      if (
        pendingOrder?.inventoryStatus ===
        "reserved"
      ) {
        await releasePendingInventory(
          pendingOrder,
        ).catch((releaseErr) => {
          console.error(
            "Failed to release inventory after checkout error:",
            releaseErr,
          );
        });

        pendingOrder.status =
          "cancelled";

        await pendingOrder
          .save()
          .catch((saveErr) => {
            console.error(
              "Failed to mark pending order cancelled:",
              saveErr,
            );
          });
      } else if (
        reservedItems.length > 0
      ) {
        await releaseInventory(
          reservedItems,
          reservationId,
        ).catch((releaseErr) => {
          console.error(
            "Failed to release reserved inventory after checkout error:",
            releaseErr,
          );
        });
      }

      res.status(400).send({
        error: err.message,
      });
    }
  };

/**
 * Compatibility endpoint for the success
 * page.
 *
 * Order creation remains webhook-driven.
 */
export const confirmPayment = async (
  req,
  res,
) => {
  try {
    const {
      paymentIntentId,
    } = req.body;

    if (typeof paymentIntentId !== "string" || !/^pi_[a-zA-Z0-9]+$/.test(paymentIntentId)) {
      return res
        .status(400)
        .json({
          success: false,

          error:
            "Valid Stripe PaymentIntent ID is required",
        });
    }

    // Ownership must be established BEFORE any provider lookup or order mutation.
    const ownedPendingOrder = await PendingOrder.findOne({
      stripePaymentIntentId: paymentIntentId,
      userId: req.user.userId,
    });
    if (!ownedPendingOrder) return res.status(404).json({ error: "Checkout not found" });

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    let order = await Order.findOne({
      "payment.transactionId": paymentIntentId,
      userId: req.user.userId,
    });

    const pendingOrder = ownedPendingOrder;

    if (
      !order &&
      pendingOrder &&
      paymentIntent.status ===
        "succeeded"
    ) {
      order =
        await finalizePendingOrder(
          pendingOrder,
          paymentIntent,
        );

      await sendOrderConfirmationEmailOnce(
        order,
      );

      try {
        await sendMerchantOrderNotificationEmailOnce(
          order,
        );
      } catch (emailError) {
        console.error(
          "Merchant order notification failed:",
          {
            orderId:
              order.orderId,

            error:
              emailError.message,
          },
        );
      }
    }

    res.json({
      success:
        paymentIntent.status ===
        "succeeded",

      status:
        paymentIntent.status,

      orderCreated:
        Boolean(order),

      orderId:
        order?.orderId,

      pendingOrderStatus:
        pendingOrder?.status,
    });
  } catch (err) {
    console.error(
      "Confirm payment status error:",
      err,
    );

    res.status(500).json({
      success: false,

      error:
        "Failed to check payment status",
    });
  }
};

export const handleStripeWebhook =
  async (req, res) => {
    const signature =
      req.headers[
        "stripe-signature"
      ];

    const webhookSecret =
      process.env
        .STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error(
        "Missing STRIPE_WEBHOOK_SECRET environment variable",
      );

      return res
        .status(500)
        .send(
          "Webhook secret is not configured",
        );
    }

    let event;

    try {
      event =
        stripe.webhooks.constructEvent(
          req.body,
          signature,
          webhookSecret,
        );
    } catch (err) {
      console.error(
        "Stripe webhook signature verification failed:",
        err.message,
      );

      return res
        .status(400)
        .send(
          `Webhook Error: ${err.message}`,
        );
    }

    try {
      if (
        event.type ===
          "payment_intent.succeeded" ||
        event.type ===
          "payment_intent.payment_failed"
      ) {
        const paymentIntent =
          event.data.object;

        const pendingOrder =
          await PendingOrder.findById(
            paymentIntent.metadata
              ?.pendingOrderId,
          );

        if (!pendingOrder) {
          console.error(
            "Pending order not found for webhook:",
            {
              eventType:
                event.type,

              paymentIntentId:
                paymentIntent.id,

              pendingOrderId:
                paymentIntent
                  .metadata
                  ?.pendingOrderId,
            },
          );

          return res.json({
            received: true,
          });
        }

        if (
          event.type ===
          "payment_intent.succeeded"
        ) {
          const order =
            await finalizePendingOrder(
              pendingOrder,
              paymentIntent,
            );

          await sendOrderConfirmationEmailOnce(
            order,
          );
          await sendMerchantOrderNotificationEmailOnce(order);

          return res.json({
            received: true,

            orderId:
              order.orderId,
          });
        }

        // A failed card attempt can leave a reusable PaymentIntent.
        // Do NOT return stock to inventory until the intent cannot later succeed.
        if (pendingOrder.status === "paid") return res.json({ received: true });
        const latestIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);
        if (latestIntent.status === "succeeded") {
          const order = await finalizePendingOrder(pendingOrder, latestIntent);
          await sendOrderConfirmationEmailOnce(order);
          await sendMerchantOrderNotificationEmailOnce(order);
          return res.json({ received: true });
        }
        if (latestIntent.status !== "canceled") {
          if (!["requires_payment_method", "requires_confirmation", "requires_action"].includes(latestIntent.status)) {
            console.error("Stripe failure needs reconciliation", { paymentIntentId: paymentIntent.id, status: latestIntent.status });
            return res.status(503).json({ error: "Payment state needs reconciliation" });
          }
          const cancelled = await stripe.paymentIntents.cancel(latestIntent.id);
          if (cancelled.status !== "canceled") throw new Error("Stripe cancellation not confirmed");
        }
        const releaseResult = await releasePendingInventory(pendingOrder);
        if (!releaseResult.success) throw new Error("Failed to release inventory after Stripe failure");
        pendingOrder.status = "failed";
        pendingOrder.paymentState = "failed";
        await pendingOrder.save();

        return res.json({
          received: true,
        });
      }

      if (
        event.type ===
        "charge.refunded"
      ) {
        const charge =
          event.data.object;

        await Order.findOneAndUpdate(
          {
            "payment.transactionId":
              charge.payment_intent,
          },

          {
            "payment.status":
              "refunded",

            status: "cancelled",
          },
        );

        return res.json({
          received: true,
        });
      }

      if (
        event.type ===
        "charge.dispute.created"
      ) {
        const dispute =
          event.data.object;

        await Order.findOneAndUpdate(
          {
            "payment.transactionId":
              dispute.payment_intent,
          },

          {
            status: "cancelled",

            "metadata.disputeId":
              dispute.id,

            "metadata.disputeStatus":
              dispute.status,
          },
        );

        return res.json({
          received: true,
        });
      }

      res.json({
        received: true,
      });
    } catch (err) {
      console.error(
        "Stripe webhook processing failed:",
        err,
      );

      res
        .status(500)
        .send(
          "Webhook processing failed",
        );
    }
  };
