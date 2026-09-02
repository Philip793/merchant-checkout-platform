import mongoose from "mongoose";

const PendingOrderItemSchema =
  new mongoose.Schema(
    {
      productId: {
        type: Number,
        required: true,
      },

      name: {
        type: String,
        required: true,
        trim: true,
      },

      price: {
        type: Number,
        required: true,
        min: 0,
      },

      quantity: {
        type: Number,
        required: true,
        min: 1,
      },

      sku: {
        type: String,
        trim: true,
      },
    },
    {
      _id: false,
    },
  );

const PendingOrderSchema =
  new mongoose.Schema(
    {
      /*
       * Authenticated account that owns
       * this pending checkout.
       */
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [
          true,
          "Pending order owner is required",
        ],
        index: true,
      },

      /*
       * Payment provider responsible for
       * this pending checkout.
       *
       * Default keeps existing Stripe
       * PendingOrder creation compatible.
       */
      paymentProvider: {
        type: String,
        required: true,
        enum: [
          "stripe",
          "braintree",
        ],
        default: "stripe",
        index: true,
      },

      /*
       * Client checkout identifier used
       * to make Braintree requests
       * idempotent.
       *
       * The controller will never use
       * this as ownership proof.
       */
      idempotencyKey: {
        type: String,
        trim: true,
        maxlength: 200,
      },

      items: {
        type: [
          PendingOrderItemSchema,
        ],

        required: true,

        validate: {
          validator: (items) =>
            Array.isArray(items) &&
            items.length > 0,

          message:
            "Pending order must contain at least one item",
        },
      },

      subtotal: {
        type: Number,
        required: true,
        min: 0,
      },

      shipping: {
        type: Number,
        required: true,
        min: 0,
      },

      total: {
        type: Number,
        required: true,
        min: 0,
      },

      currency: {
        type: String,
        required: true,
        default: "AUD",
        uppercase: true,
      },

      shippingCountry: {
        type: String,
        required: true,
        enum: [
          "AU",
          "US",
        ],
        default: "AU",
      },

      customer: {
        email: {
          type: String,
          trim: true,
          lowercase: true,
        },

        name: {
          type: String,
          trim: true,
        },
      },

      shippingAddress: {
        fullName: {
          type: String,
          trim: true,
        },

        street: {
          type: String,
          trim: true,
        },

        city: {
          type: String,
          trim: true,
        },

        state: {
          type: String,
          trim: true,
        },

        zip: {
          type: String,
          trim: true,
        },

        country: {
          type: String,
          trim: true,
        },

        phone: {
          type: String,
          trim: true,
        },
      },

      /*
       * Stripe provider reference.
       */
      stripePaymentIntentId: {
        type: String,
        index: true,
      },

      /*
       * Braintree provider reference.
       *
       * Once this exists, we know a
       * Braintree transaction has already
       * been created and must NOT charge
       * the customer again on a retry.
       */
      braintreeTransactionId: {
        type: String,
      },

      /*
       * Tracks the payment attempt separately
       * from the overall PendingOrder status.
       *
       * This allows the durable PendingOrder
       * itself to remain present even if the
       * process crashes during payment.
       */
      paymentState: {
        type: String,
        required: true,

        enum: [
          "not_started",
          "processing",
          "succeeded",
          "failed",
        ],

        default:
          "not_started",

        index: true,
      },

      paymentAttemptedAt: {
        type: Date,
      },

      paymentCompletedAt: {
        type: Date,
      },

      /*
       * Permanent order produced from
       * this pending checkout.
       */
      finalizedOrderId: {
        type: String,
        index: true,
      },

      /*
       * Overall checkout state.
       */
      status: {
        type: String,
        required: true,

        enum: [
          "pending",
          "paid",
          "failed",
          "cancelled",
          "expired",
        ],

        default: "pending",
        index: true,
      },

      inventoryStatus: {
        type: String,
        required: true,

        enum: [
          "reserved",
          "confirmed",
          "released",
        ],

        default: "reserved",
      },

      expiresAt: {
        type: Date,
        required: true,
        index: true,
      },

      /*
       * Useful operational evidence if
       * finalisation fails after payment.
       *
       * Do not store secrets or raw payment
       * details here.
       */
      failureReason: {
        type: String,
        trim: true,
        maxlength: 1000,
      },

      metadata: {
        type: Map,
        of: String,
      },
    },
    {
      timestamps: true,
    },
  );

/*
 * Existing expiry lookup.
 */
PendingOrderSchema.index({
  status: 1,
  expiresAt: 1,
});

/*
 * Customer checkout history.
 */
PendingOrderSchema.index({
  userId: 1,
  createdAt: -1,
});

/*
 * One idempotency key can only represent
 * one checkout for one customer/provider.
 *
 * Stripe does not currently supply an
 * idempotencyKey, so the partial index
 * only applies when one exists.
 */
PendingOrderSchema.index(
  {
    userId: 1,
    paymentProvider: 1,
    idempotencyKey: 1,
  },
  {
    unique: true,

    partialFilterExpression: {
      idempotencyKey: {
        $type: "string",
      },
    },
  },
);

/*
 * A Braintree transaction can only belong
 * to one PendingOrder.
 */
PendingOrderSchema.index(
  {
    braintreeTransactionId: 1,
  },
  {
    unique: true,
    sparse: true,
  },
);

const PendingOrder =
  mongoose.model(
    "PendingOrder",
    PendingOrderSchema,
  );

export default PendingOrder;