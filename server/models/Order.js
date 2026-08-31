import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema({
  productId: {
    type: Number,
    required: [true, "Product ID is required"],
  },

  name: {
    type: String,
    required: [true, "Product name is required"],
    trim: true,
  },

  price: {
    type: Number,
    required: [true, "Product price is required"],
    min: 0,
  },

  quantity: {
    type: Number,
    required: [true, "Quantity is required"],
    min: 1,
    default: 1,
  },

  sku: {
    type: String,
    trim: true,
  },
});

const OrderSchema = new mongoose.Schema(
  {
    /*
     * Immutable owner of the order.
     *
     * Security:
     * Customer order access must be checked against this userId,
     * not against client-supplied email addresses.
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Order owner is required"],
      index: true,
    },

    orderId: {
      type: String,
      unique: true,
      index: true,
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

    items: {
      type: [OrderItemSchema],
      required: [true, "Order must contain at least one item"],

      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },

        message: "Order must contain at least one item",
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
      default: 10.0,
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

    payment: {
      provider: {
        type: String,
        required: true,
        enum: ["stripe", "braintree", "paypal", "test"],
      },

      transactionId: {
        type: String,
        required: true,
      },

      status: {
        type: String,
        required: true,
        enum: ["pending", "completed", "failed", "refunded"],
        default: "pending",
      },

      paidAt: {
        type: Date,
      },
    },

    email: {
      confirmationSentAt: {
        type: Date,
      },

      confirmationError: {
        type: String,
        trim: true,
      },
    },

    status: {
      type: String,
      required: true,
      enum: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
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
        default: "Australia",
      },

      phone: {
        type: String,
        trim: true,
      },
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
 * Indexes for common queries.
 */
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ "customer.email": 1 });

/*
 * Efficient customer order lookup.
 *
 * This supports queries such as:
 * {
 *   orderId,
 *   userId: req.user.userId
 * }
 */
OrderSchema.index({
  userId: 1,
  createdAt: -1,
});

OrderSchema.index(
  { "payment.transactionId": 1 },
  { unique: true },
);

const Order = mongoose.model("Order", OrderSchema);

export default Order;