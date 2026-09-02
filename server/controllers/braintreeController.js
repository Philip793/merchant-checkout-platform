import gateway from "../config/braintree.js";

import {
  sendOrderConfirmationEmailOnce,
  sendMerchantOrderNotificationEmail,
} from "../services/emailService.js";

import {
  calculateCartTotal,
} from "../data/productCatalog.js";

import {
  createOrder,
} from "./orderController.js";

import Order from "../models/Order.js";
import PendingOrder from "../models/PendingOrder.js";

import {
  reserveInventory,
  confirmInventory,
  releaseInventory,
} from "../services/inventoryService.js";

const PENDING_ORDER_TTL_MINUTES = 30;

/*
 * Convert a PendingOrder's authoritative
 * items into the format expected by the
 * inventory service.
 */
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

/*
 * Release inventory only once.
 */
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
      );

    if (inventoryResult.success) {
      pendingOrder.inventoryStatus =
        "released";

      await pendingOrder.save();
    }

    return inventoryResult;
  };

/*
 * Finalize a successfully paid Braintree
 * PendingOrder into a permanent Order.
 *
 * This function is deliberately idempotent.
 *
 * Calling it multiple times with the same
 * Braintree transaction must never create
 * multiple permanent orders.
 */
const finalizeBraintreePendingOrder =
  async (pendingOrder) => {
    if (!pendingOrder) {
      throw new Error(
        "Pending order is required",
      );
    }

    if (!pendingOrder.userId) {
      throw new Error(
        `Pending order ${pendingOrder._id} has no owner`,
      );
    }

    if (
      pendingOrder.paymentState !==
        "succeeded" ||
      !pendingOrder.braintreeTransactionId
    ) {
      throw new Error(
        `Pending order ${pendingOrder._id} has not completed payment`,
      );
    }

    /*
     * First check whether this pending order
     * already knows its permanent order.
     */
    if (
      pendingOrder.finalizedOrderId
    ) {
      const finalizedOrder =
        await Order.findOne({
          orderId:
            pendingOrder.finalizedOrderId,
        });

      if (finalizedOrder) {
        /*
         * If inventory was not confirmed during
         * an earlier attempt, retry it safely.
         */
        if (
          pendingOrder.inventoryStatus ===
          "reserved"
        ) {
          const inventoryResult =
            await confirmInventory(
              buildInventoryItems(
                pendingOrder,
              ),
            );

          if (
            inventoryResult.success
          ) {
            pendingOrder.inventoryStatus =
              "confirmed";

            await pendingOrder.save();
          }
        }

        return {
          order: finalizedOrder,
          created: false,
        };
      }
    }

    /*
     * Second idempotency check:
     *
     * If Mongo saved the permanent Order but the
     * process failed before PendingOrder was updated,
     * locate it using the unique provider transaction.
     */
    const existingOrder =
      await Order.findOne({
        "payment.transactionId":
          pendingOrder
            .braintreeTransactionId,
      });

    if (existingOrder) {
      pendingOrder.finalizedOrderId =
        existingOrder.orderId;

      pendingOrder.status = "paid";

      if (
        pendingOrder.inventoryStatus ===
        "reserved"
      ) {
        const inventoryResult =
          await confirmInventory(
            buildInventoryItems(
              pendingOrder,
            ),
          );

        if (
          inventoryResult.success
        ) {
          pendingOrder.inventoryStatus =
            "confirmed";
        } else {
          pendingOrder.failureReason =
            "Permanent order exists but inventory confirmation failed.";
        }
      }

      await pendingOrder.save();

      return {
        order: existingOrder,
        created: false,
      };
    }

    /*
     * No permanent order exists yet.
     * Build it entirely from the durable,
     * server-calculated PendingOrder.
     */
    const orderData = {
      userId:
        pendingOrder.userId,

      customer:
        pendingOrder.customer || {},

      shippingAddress: {
        ...(pendingOrder
          .shippingAddress || {}),

        country:
          pendingOrder
            .shippingCountry ===
          "US"
            ? "United States"
            : "Australia",
      },

      items:
        pendingOrder.items.map(
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

      total:
        pendingOrder.total,

      currency:
        pendingOrder.currency,

      payment: {
        provider: "braintree",

        transactionId:
          pendingOrder
            .braintreeTransactionId,

        status: "completed",

        paidAt:
          pendingOrder
            .paymentCompletedAt ||
          new Date(),
      },

      status: "pending",

      metadata: {
        pendingOrderId:
          pendingOrder._id.toString(),

        shippingCountry:
          pendingOrder
            .shippingCountry,

        braintreeTransactionId:
          pendingOrder
            .braintreeTransactionId,
      },
    };

    /*
     * createOrder() throws here rather than
     * silently returning null.
     */
    const order =
      await createOrder(
        orderData,
        {
          throwOnError: true,
        },
      );

    /*
     * Record the permanent order immediately.
     *
     * If inventory confirmation fails afterward,
     * a retry can recover using finalizedOrderId.
     */
    pendingOrder.finalizedOrderId =
      order.orderId;

    pendingOrder.status = "paid";

    pendingOrder.failureReason =
      undefined;

    await pendingOrder.save();

    /*
     * Convert reservation into sold inventory.
     */
    if (
      pendingOrder.inventoryStatus ===
      "reserved"
    ) {
      const inventoryResult =
        await confirmInventory(
          buildInventoryItems(
            pendingOrder,
          ),
        );

      if (
        inventoryResult.success
      ) {
        pendingOrder.inventoryStatus =
          "confirmed";

        await pendingOrder.save();
      } else {
        pendingOrder.failureReason =
          "Payment and order succeeded, but inventory confirmation failed.";

        await pendingOrder.save();

        /*
         * Payment and permanent order already
         * exist, so do NOT delete anything and
         * do NOT release inventory.
         *
         * A retry can safely attempt confirmation
         * again.
         */
        throw new Error(
          "Order was created but inventory confirmation failed",
        );
      }
    }

    return {
      order,
      created: true,
    };
  };

/**
 * Generate Braintree client token.
 *
 * Never accept Braintree customerId
 * from the browser.
 */
export const getClientToken = async (
  req,
  res,
) => {
  try {
    if (!req.user) {
      return res.status(401).send({
        success: false,
        error:
          "Authentication required",
      });
    }

    const response =
      await gateway.clientToken.generate(
        {},
      );

    res.set(
      "Cache-Control",
      "no-store",
    );

    return res.status(200).send({
      clientToken:
        response.clientToken,
    });
  } catch (err) {
    console.error(
      "Braintree token error:",
      err,
    );

    return res.status(500).send({
      success: false,

      error:
        "Unable to initialize payment provider",
    });
  }
};

/**
 * Braintree checkout.
 *
 * DURABILITY MODEL:
 *
 * 1. Authenticate customer
 * 2. Calculate authoritative total
 * 3. Reserve stock
 * 4. Persist PendingOrder
 * 5. Mark payment processing
 * 6. Call Braintree
 * 7. Persist provider transaction ID
 * 8. Create permanent Order
 * 9. Confirm inventory
 *
 * Money is therefore never intentionally
 * requested before a durable checkout record
 * exists.
 */
export const checkoutWithCart =
  async (req, res) => {
    let pendingOrder = null;

    let newlyReservedItems = [];

    try {
      const authenticatedUserId =
        req.user?.userId;

      if (!authenticatedUserId) {
        return res
          .status(401)
          .send({
            success: false,

            error:
              "Your login session is outdated. Please log out and log in again.",
          });
      }

const {
  nonce,
  cartItems,
  customer = {},
  shippingAddress = {},
  idempotencyKey,
} = req.body;

      /*
       * A client-generated checkout identifier
       * is mandatory.
       *
       * It is NOT used as proof of ownership.
       * Ownership always comes from req.user.
       */
      if (
        !idempotencyKey ||
        typeof idempotencyKey !==
          "string" ||
        idempotencyKey.trim().length <
          10 ||
        idempotencyKey.trim().length >
          200
      ) {
        return res
          .status(400)
          .send({
            success: false,

            error:
              "A valid checkout idempotency key is required",
          });
      }

      const safeIdempotencyKey =
        idempotencyKey.trim();

      /*
       * Check for an existing checkout BEFORE
       * reserving more inventory.
       */
      pendingOrder =
        await PendingOrder.findOne({
          userId:
            authenticatedUserId,

          paymentProvider:
            "braintree",

          idempotencyKey:
            safeIdempotencyKey,
        });

      if (pendingOrder) {
        /*
         * Already finalized:
         * return the same successful result.
         */
        if (
          pendingOrder.finalizedOrderId
        ) {
          const existingOrder =
            await Order.findOne({
              orderId:
                pendingOrder
                  .finalizedOrderId,

              userId:
                authenticatedUserId,
            });

          if (existingOrder) {
            return res.status(200).send({
              success: true,

              transactionId:
                pendingOrder
                  .braintreeTransactionId,

              orderId:
                existingOrder.orderId,

              orderSummary: {
                items:
                  pendingOrder.items.map(
                    (item) => ({
                      id:
                        item.productId,

                      name:
                        item.name,

                      price:
                        item.price,

                      quantity:
                        item.quantity,

                      sku:
                        item.sku,

                      total: (
                        item.price *
                        item.quantity
                      ).toFixed(2),
                    }),
                  ),

                subtotal:
                  pendingOrder.subtotal.toFixed(
                    2,
                  ),

                shipping:
                  pendingOrder.shipping.toFixed(
                    2,
                  ),

                total:
                  pendingOrder.total.toFixed(
                    2,
                  ),

                shippingCountry:
                  pendingOrder
                    .shippingCountry,
              },

              reused: true,
            });
          }
        }

        /*
         * Payment succeeded, but permanent-order
         * finalization did not complete.
         *
         * Recover without charging again.
         */
        if (
          pendingOrder.paymentState ===
            "succeeded" &&
          pendingOrder
            .braintreeTransactionId
        ) {
          const {
            order,
            created,
          } =
            await finalizeBraintreePendingOrder(
              pendingOrder,
            );

          await sendOrderConfirmationEmailOnce(
            order,
          );

          if (created) {
            try {
              await sendMerchantOrderNotificationEmail(
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

          return res.status(200).send({
            success: true,

            transactionId:
              pendingOrder
                .braintreeTransactionId,

            orderId:
              order.orderId,

            reused: true,
          });
        }

        /*
         * Critical duplicate-charge protection.
         *
         * Once an attempt is marked processing,
         * we will NOT submit another sale using
         * the same idempotency key.
         *
         * This is intentionally conservative.
         */
        if (
          pendingOrder.paymentState ===
          "processing"
        ) {
          return res
            .status(409)
            .send({
              success: false,

              pending: true,

              pendingOrderId:
                pendingOrder._id.toString(),

              error:
                "This payment attempt is already being processed. It will not be charged again.",
            });
        }

        /*
         * Failed/expired/released attempts require
         * a fresh checkout/idempotency key.
         */
        if (
          pendingOrder.paymentState ===
            "failed" ||
          pendingOrder.status ===
            "failed" ||
          pendingOrder.status ===
            "expired" ||
          pendingOrder.status ===
            "cancelled"
        ) {
          return res
            .status(409)
            .send({
              success: false,

              error:
                "This checkout attempt can no longer be reused. Please start a new checkout.",
            });
        }

        /*
         * paymentState === not_started can safely
         * continue because no provider payment
         * attempt has occurred yet.
         */
      }

      /*
       * A nonce is only required if we're about
       * to make a new provider payment attempt.
       */
      if (!nonce) {
        return res
          .status(400)
          .send({
            success: false,

            error:
              "Payment nonce is required",
          });
      }

      if (
        !Array.isArray(
          cartItems,
        ) ||
        cartItems.length === 0
      ) {
        return res
          .status(400)
          .send({
            success: false,

            error:
              "Invalid or empty cart",
          });
      }

      

      const safeCustomer = {
        email:
          req.user?.email ||
          customer.email ||
          "",

        name:
          customer.name ||
          req.user?.name ||
          "Customer",
      };

      /*
       * Server-authoritative product prices.
       */
const orderSummary =
  calculateCartTotal(
    cartItems,
    {
      shippingAddress,
    },
  );

      const inventoryItems =
        orderSummary.items.map(
          (item) => ({
            id: item.id,
            quantity:
              item.quantity,
          }),
        );

      /*
       * If no durable PendingOrder exists yet,
       * reserve stock and create it BEFORE
       * talking to Braintree.
       */
      if (!pendingOrder) {
        const reservationResult =
          await reserveInventory(
            inventoryItems,
          );

        if (
          !reservationResult.success
        ) {
          return res
            .status(400)
            .send({
              success: false,

              error:
                "Insufficient inventory",

              details:
                reservationResult.errors,
            });
        }

        newlyReservedItems =
          inventoryItems;

        try {
          pendingOrder =
            await PendingOrder.create({
              userId:
                authenticatedUserId,

              paymentProvider:
                "braintree",

              idempotencyKey:
                safeIdempotencyKey,

              items:
                orderSummary.items.map(
                  (item) => ({
                    productId:
                      item.id,

                    name:
                      item.name,

                    price:
                      item.price,

                    quantity:
                      item.quantity,

                    sku:
                      item.sku ||
                      `SKU-${item.id}`,
                  }),
                ),

              subtotal:
                Number(
                  orderSummary.subtotal,
                ),

              shipping:
                Number(
                  orderSummary.shipping,
                ),

              total:
                Number(
                  orderSummary.total,
                ),

              currency: "AUD",

              shippingCountry:
                orderSummary
                  .shippingCountry,

              customer:
                safeCustomer,

              shippingAddress: {
                ...shippingAddress,

                country:
                  orderSummary
                    .shippingCountry ===
                  "US"
                    ? "United States"
                    : "Australia",
              },

              inventoryStatus:
                "reserved",

              paymentState:
                "not_started",

              status: "pending",

              expiresAt: new Date(
                Date.now() +
                  PENDING_ORDER_TTL_MINUTES *
                    60 *
                    1000,
              ),
            });

          /*
           * Reservation now belongs to this
           * durable PendingOrder.
           */
          newlyReservedItems = [];
        } catch (createError) {
          /*
           * If another simultaneous request created
           * the same idempotency key, release the
           * duplicate reservation we just made.
           */
          if (
            newlyReservedItems.length >
            0
          ) {
            await releaseInventory(
              newlyReservedItems,
            );

            newlyReservedItems = [];
          }

          if (
            createError.code ===
            11000
          ) {
            pendingOrder =
              await PendingOrder.findOne(
                {
                  userId:
                    authenticatedUserId,

                  paymentProvider:
                    "braintree",

                  idempotencyKey:
                    safeIdempotencyKey,
                },
              );

            if (pendingOrder) {
              return res
                .status(409)
                .send({
                  success: false,

                  pending: true,

                  pendingOrderId:
                    pendingOrder._id.toString(),

                  error:
                    "This checkout request is already being processed.",
                });
            }
          }

          throw createError;
        }
      }

      /*
       * DURABLE CHECKPOINT.
       *
       * At this point the customer's cart,
       * authenticated owner, total and inventory
       * reservation exist in MongoDB.
       *
       * Only now do we permit a provider charge.
       */
      pendingOrder.paymentState =
        "processing";

      pendingOrder.paymentAttemptedAt =
        new Date();

      pendingOrder.failureReason =
        undefined;

      await pendingOrder.save();

      /*
       * The Braintree orderId is the MongoDB
       * PendingOrder ID.
       *
       * This gives operators a direct correlation
       * between the provider transaction and our
       * durable checkout even if the process fails
       * immediately after payment.
       */
      const result =
        await gateway.transaction.sale(
          {
            amount:
              pendingOrder.total.toFixed(
                2,
              ),

            paymentMethodNonce:
              nonce,

            options: {
              submitForSettlement: true,
            },

            orderId:
              pendingOrder._id.toString(),
          },
        );

      /*
       * Provider explicitly rejected payment.
       *
       * We know no successful payment occurred,
       * so inventory can safely be released.
       */
      if (!result.success) {
        pendingOrder.paymentState =
          "failed";

        pendingOrder.status =
          "failed";

        pendingOrder.failureReason =
          result.message ||
          "Braintree payment failed";

        await pendingOrder.save();

        await releasePendingInventory(
          pendingOrder,
        );

        return res
          .status(400)
          .send({
            success: false,

            error:
              result.message ||
              "Payment failed",
          });
      }

      /*
       * PAYMENT SUCCEEDED.
       *
       * Persist the provider transaction reference
       * immediately before doing anything else.
       */
      pendingOrder.braintreeTransactionId =
        result.transaction.id;

      pendingOrder.paymentState =
        "succeeded";

      pendingOrder.paymentCompletedAt =
        new Date();

      pendingOrder.failureReason =
        undefined;

      await pendingOrder.save();

      /*
       * From this point onward, retrying the same
       * idempotencyKey never charges again.
       */
      const {
        order,
        created,
      } =
        await finalizeBraintreePendingOrder(
          pendingOrder,
        );

      await sendOrderConfirmationEmailOnce(
        order,
      );

      if (created) {
        try {
          await sendMerchantOrderNotificationEmail(
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

      return res.status(200).send({
        success: true,

        transactionId:
          pendingOrder
            .braintreeTransactionId,

        pendingOrderId:
          pendingOrder._id.toString(),

        orderId:
          order.orderId,

        orderSummary,

        inventoryUpdated:
          pendingOrder
            .inventoryStatus ===
          "confirmed",
      });
    } catch (err) {
      console.error(
        "Braintree checkout error:",
        err,
      );

      /*
       * If inventory was reserved but the
       * PendingOrder itself could not be created,
       * release that orphan reservation.
       */
      if (
        newlyReservedItems.length >
        0
      ) {
        try {
          await releaseInventory(
            newlyReservedItems,
          );
        } catch (releaseError) {
          console.error(
            "Failed to release orphan inventory reservation:",
            releaseError,
          );
        }
      }

      /*
       * IMPORTANT:
       *
       * If paymentState is "processing", we do NOT
       * release inventory and we do NOT automatically
       * retry payment.
       *
       * A gateway/network failure at that exact point
       * may have an uncertain payment outcome.
       *
       * Releasing stock or charging again could make
       * the situation worse.
       */
      if (
        pendingOrder &&
        pendingOrder.paymentState ===
          "processing"
      ) {
        pendingOrder.failureReason =
          `Payment outcome requires reconciliation: ${err.message}`;

        await pendingOrder
          .save()
          .catch((saveError) => {
            console.error(
              "Unable to record Braintree reconciliation state:",
              saveError,
            );
          });

        return res
          .status(502)
          .send({
            success: false,

            pending: true,

            pendingOrderId:
              pendingOrder._id.toString(),

            error:
              "The payment provider response could not be confirmed. This checkout will not be charged again automatically.",
          });
      }

      /*
       * If payment already succeeded, NEVER release
       * inventory merely because later finalisation
       * failed.
       *
       * The durable PendingOrder contains the payment
       * state and retrying the same idempotency key
       * will resume finalisation without charging.
       */
      if (
        pendingOrder &&
        pendingOrder.paymentState ===
          "succeeded"
      ) {
        pendingOrder.failureReason =
          `Payment succeeded but order finalization requires retry: ${err.message}`;

        await pendingOrder
          .save()
          .catch((saveError) => {
            console.error(
              "Unable to save Braintree post-payment failure state:",
              saveError,
            );
          });

        return res
          .status(500)
          .send({
            success: false,

            paymentSucceeded: true,

            pending: true,

            pendingOrderId:
              pendingOrder._id.toString(),

            transactionId:
              pendingOrder
                .braintreeTransactionId,

            error:
              "Payment succeeded, but order finalization is still pending. Do not submit another payment.",
          });
      }

      return res
        .status(500)
        .send({
          success: false,

          error:
            "Unable to complete checkout",
        });
    }
  };