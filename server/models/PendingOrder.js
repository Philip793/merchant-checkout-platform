import mongoose from "mongoose";

const PendingOrderItemSchema = new mongoose.Schema(
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

const PendingOrderSchema = new mongoose.Schema(
  {
    /*
     * Account that owns this pending checkout.
     *
     * This value must come from the authenticated JWT/user session,
     * never from customer-supplied checkout data.
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Pending order owner is required"],
      index: true,
    },

    items: {
      type: [PendingOrderItemSchema],
      required: true,

      validate: {
        validator: (items) =>
          Array.isArray(items) && items.length > 0,

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
      enum: ["AU", "US"],
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

    stripePaymentIntentId: {
      type: String,
      index: true,
    },

    finalizedOrderId: {
      type: String,
      index: true,
    },

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
 * Used when finding expired pending orders.
 */
PendingOrderSchema.index({
  status: 1,
  expiresAt: 1,
});

/*
 * Useful for customer-specific pending order queries
 * and ownership auditing.
 */
PendingOrderSchema.index({
  userId: 1,
  createdAt: -1,
});

const PendingOrder = mongoose.model(
  "PendingOrder",
  PendingOrderSchema,
);

export default PendingOrder;