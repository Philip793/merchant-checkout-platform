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

import {
  reserveInventory,
  confirmInventory,
  releaseInventory,
} from "../services/inventoryService.js";

/**
 * Generate a Braintree client token.
 *
 * SECURITY:
 *
 * - The route must require authentication.
 * - Never accept a Braintree customerId from the browser.
 * - This application does not currently maintain a trusted
 *   server-side mapping between MongoDB users and Braintree
 *   customer records.
 *
 * Therefore we generate an unscoped client token.
 *
 * If vaulted payment methods are added later, the Braintree
 * customer ID must be looked up server-side from the
 * authenticated user account.
 */
export const getClientToken = async (
  req,
  res,
) => {
  try {
    /*
     * Defense in depth.
     *
     * payments.js will also protect this route
     * with authenticate middleware.
     */
    if (!req.user) {
      return res.status(401).send({
        success: false,
        error: "Authentication required",
      });
    }

    /*
     * CRITICAL SECURITY FIX:
     *
     * Previously:
     *
     * gateway.clientToken.generate({
     *   customerId: req.query.customerId,
     * });
     *
     * That allowed a caller to supply an arbitrary
     * Braintree customer ID.
     *
     * Now:
     *
     * No customerId is accepted from the request.
     */
    const response =
      await gateway.clientToken.generate({});

    /*
     * Client tokens should not be cached by
     * browsers or intermediary caches.
     */
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
 * Secure checkout endpoint.
 *
 * Product prices and totals are calculated
 * from trusted server-side catalogue data.
 *
 * SECURITY:
 * The authenticated MongoDB user ID is stored
 * as the permanent owner of the order.
 */
export const checkoutWithCart =
  async (req, res) => {
    let inventoryReserved = false;
    let paymentSucceeded = false;
    let transactionId = null;

    try {
      console.log(
        "Request received at /braintree/checkout-with-cart",
      );

      /*
       * Ownership comes from the verified JWT.
       *
       * Never accept userId from req.body.
       */
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
        shippingCountry = "AU",
        customer = {},
        shippingAddress = {},
      } = req.body;

      /*
       * Validate inputs.
       */
      if (!nonce) {
        return res
          .status(400)
          .send({
            error:
              "Payment nonce is required",
          });
      }

      if (
        !cartItems ||
        !Array.isArray(
          cartItems,
        ) ||
        cartItems.length === 0
      ) {
        return res
          .status(400)
          .send({
            error:
              "Invalid or empty cart",
          });
      }

      /*
       * Only allow supported shipping countries.
       *
       * NOTE:
       * Shipping/address binding is a separate
       * critical blocker and will be fixed later.
       */
      const normalisedShippingCountry =
        shippingCountry === "US" ||
        shippingCountry === "AU"
          ? shippingCountry
          : "AU";

      /*
       * Use authenticated user data where possible.
       *
       * Customer email is NOT used for ownership.
       */
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
       * Calculate total using trusted
       * server-side product catalogue.
       */
      const orderSummary =
        calculateCartTotal(
          cartItems,
          {
            shippingCountry:
              normalisedShippingCountry,
          },
        );

      console.log(
        "Processing Braintree payment for amount:",
        orderSummary.total,
      );

      /*
       * Reserve inventory before charging.
       */
      const reservationResult =
        await reserveInventory(
          cartItems,
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

      inventoryReserved = true;

      /*
       * Charge Braintree.
       *
       * NOTE:
       * The durability problem where payment can
       * succeed before order persistence is another
       * critical blocker and will be fixed separately.
       */
      const result =
        await gateway.transaction.sale(
          {
            amount:
              orderSummary.total,

            paymentMethodNonce:
              nonce,

            options: {
              submitForSettlement: true,
            },

            orderId:
              `ORDER-${Date.now()}`,
          },
        );

      if (!result.success) {
        console.error(
          "Braintree transaction failed:",
          result.message,
        );

        /*
         * Payment failed, therefore release
         * the reserved inventory.
         */
        await releaseInventory(
          cartItems,
        );

        inventoryReserved = false;

        return res
          .status(400)
          .send({
            success: false,

            error:
              result.message,
          });
      }

      paymentSucceeded = true;

      transactionId =
        result.transaction.id;

      console.log(
        "Braintree transaction successful:",
        transactionId,
      );

      /*
       * Prepare permanent order.
       */
      const orderData = {
        /*
         * CRITICAL OWNERSHIP FIELD.
         *
         * This value originates from the JWT,
         * never the browser request body.
         */
        userId:
          authenticatedUserId,

        customer:
          safeCustomer,

        shippingAddress: {
          ...shippingAddress,

          country:
            orderSummary.shippingCountry ===
            "US"
              ? "United States"
              : "Australia",
        },

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
          parseFloat(
            orderSummary.subtotal,
          ),

        shipping:
          parseFloat(
            orderSummary.shipping,
          ),

        total:
          parseFloat(
            orderSummary.total,
          ),

        currency: "AUD",

        payment: {
          provider:
            "braintree",

          transactionId,

          status:
            "completed",

          paidAt:
            new Date(),
        },

        status: "pending",

        metadata: {
          shippingCountry:
            orderSummary.shippingCountry,

          braintreeTransactionId:
            transactionId,
        },
      };

      /*
       * Save permanent order.
       */
      const order =
        await createOrder(
          orderData,
          {
            throwOnError: true,
          },
        );

      /*
       * Send confirmation emails.
       */
      await sendOrderConfirmationEmailOnce(
        order,
      );

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

      /*
       * Convert reserved inventory
       * into sold inventory.
       */
      const inventoryResult =
        await confirmInventory(
          cartItems,
        );

      if (
        !inventoryResult.success
      ) {
        console.error(
          "⚠️ Inventory confirmation failed:",
          inventoryResult.errors,
        );

        /*
         * Do not fail the response here because
         * the customer has already paid.
         *
         * This lifecycle issue will be addressed
         * under the inventory/state-machine blocker.
         */
      }

      return res.send({
        success: true,

        transactionId,

        orderSummary,

        orderId:
          order?.orderId,

        inventoryUpdated:
          inventoryResult.success,
      });
    } catch (err) {
      console.error(
        "Braintree checkout error:",
        err,
      );

      /*
       * Only release inventory when
       * payment did NOT succeed.
       */
      if (
        inventoryReserved &&
        !paymentSucceeded
      ) {
        try {
          await releaseInventory(
            req.body.cartItems ||
              [],
          );
        } catch (releaseErr) {
          console.error(
            "Failed to release inventory after error:",
            releaseErr,
          );
        }
      }

      return res
        .status(500)
        .send({
          success: false,

          error:
            err.message,

          transactionId,
        });
    }
  };