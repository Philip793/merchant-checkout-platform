import mongoose from "mongoose";

/*
 * Each stock reservation belongs to one
 * specific checkout.
 *
 * This prevents one order from confirming
 * or releasing inventory reserved by another.
 */
const InventoryReservationSchema =
  new mongoose.Schema(
    {
      reservationId: {
        type: String,
        required: true,
        trim: true,
      },

      quantity: {
        type: Number,
        required: true,
        min: 1,
      },

      status: {
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
      },

      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: false,
    },
  );

/**
 * Inventory Model
 *
 * totalStock
 *   Physical unsold stock.
 *
 * availableStock
 *   Stock customers can currently purchase.
 *
 * reservedStock
 *   Stock temporarily assigned to active
 *   checkout reservations.
 *
 * reservations
 *   Ownership ledger showing which checkout
 *   owns each reservation.
 */
const InventorySchema =
  new mongoose.Schema(
    {
      productId: {
        type: Number,
        required: true,
        unique: true,
        index: true,
      },

      name: {
        type: String,
        required: true,
      },

      sku: {
        type: String,
        required: true,
        index: true,
      },

      totalStock: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },

      availableStock: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },

      reservedStock: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },

      /*
       * Per-checkout ownership ledger.
       *
       * Older Inventory documents will simply
       * receive an empty array when loaded.
       */
      reservations: {
        type: [InventoryReservationSchema],
        default: [],
      },

      lowStockThreshold: {
        type: Number,
        default: 10,
      },

      lastSync: {
        type: Date,
        default: Date.now,
      },
    },
    {
      timestamps: true,
    },
  );

InventorySchema.index({
  availableStock: 1,
  lowStockThreshold: 1,
});

/*
 * Fast lookup when confirming/releasing a
 * particular checkout reservation.
 */
InventorySchema.index({
  "reservations.reservationId": 1,
});

/*
 * Useful to the reservation expiry worker.
 */
InventorySchema.index({
  "reservations.status": 1,
  "reservations.expiresAt": 1,
});

InventorySchema.virtual(
  "isLowStock",
).get(function () {
  return (
    this.availableStock <=
    this.lowStockThreshold
  );
});

/**
 * Atomically reserve this product for one
 * checkout.
 *
 * The reservationId is part of the atomic
 * condition, so retrying the same reservation
 * cannot decrement available stock twice.
 */
InventorySchema.statics.reserveForCheckout =
  async function ({
    productId,
    quantity,
    reservationId,
    expiresAt,
  }) {
    if (
      !reservationId ||
      typeof reservationId !== "string"
    ) {
      throw new Error(
        "reservationId is required",
      );
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      throw new Error(
        "Reservation quantity must be a positive integer",
      );
    }

    if (
      !(expiresAt instanceof Date) ||
      !Number.isFinite(expiresAt.getTime()) ||
      expiresAt <= new Date()
    ) {
      throw new Error("Reservation requires a future expiry date");
    }

    /*
     * Only create a new reservation when this
     * reservationId is not already present.
     */
    const result =
      await this.findOneAndUpdate(
        {
          productId,

          availableStock: {
            $gte: quantity,
          },

          "reservations.reservationId": {
            $ne: reservationId,
          },
        },

        {
          $inc: {
            availableStock:
              -quantity,

            reservedStock:
              quantity,
          },

          $push: {
            reservations: {
              reservationId,
              quantity,
              status: "reserved",
              expiresAt,
              updatedAt:
                new Date(),
            },
          },

          $set: {
            lastSync:
              new Date(),
          },
        },

        {
          new: true,
        },
      );

    if (result) {
      return {
        success: true,
        alreadyReserved: false,
        inventory: result,
      };
    }

    /*
     * The update may have failed because:
     *
     * 1. stock is insufficient, or
     * 2. this exact reservation already exists.
     *
     * Check for case 2 so reservation retries
     * are idempotent.
     */
    const existing =
      await this.findOne({
        productId,
        "reservations.reservationId":
          reservationId,
      });

    if (existing) {
      const reservation =
        existing.reservations.find(
          (entry) =>
            entry.reservationId ===
            reservationId,
        );

      if (
        reservation &&
        reservation.quantity ===
          quantity &&
        reservation.status ===
          "reserved"
      ) {
        return {
          success: true,
          alreadyReserved: true,
          inventory: existing,
        };
      }

      return {
        success: false,

        reason:
          "Reservation ID already exists in an incompatible state",
      };
    }

    return {
      success: false,

      reason:
        "Insufficient available inventory",
    };
  };

/**
 * Confirm one product reservation.
 *
 * Only a reservation belonging to this exact
 * reservationId can be converted into sold
 * stock.
 */
InventorySchema.statics.confirmReservation =
  async function ({
    productId,
    quantity,
    reservationId,
  }) {
    if (!reservationId || !Number.isInteger(quantity) || quantity < 1) {
      throw new Error("Invalid reservation confirmation request");
    }
    const result =
      await this.findOneAndUpdate(
        {
          productId,

          reservations: {
            $elemMatch: {
              reservationId,
              quantity,
              status:
                "reserved",
            },
          },

          reservedStock: {
            $gte: quantity,
          },

          totalStock: {
            $gte: quantity,
          },
        },

        {
          $inc: {
            reservedStock:
              -quantity,

            totalStock:
              -quantity,
          },

          $set: {
            "reservations.$.status":
              "confirmed",

            "reservations.$.updatedAt":
              new Date(),

            lastSync:
              new Date(),
          },
        },

        {
          new: true,
        },
      );

    if (result) {
      return {
        success: true,
        alreadyConfirmed: false,
        inventory: result,
      };
    }

    /*
     * Idempotency:
     *
     * If this reservation was already confirmed,
     * a webhook/retry should count as success
     * rather than deducting stock again.
     */
    const existing =
      await this.findOne({
        productId,
        "reservations.reservationId":
          reservationId,
      });

    const reservation =
      existing?.reservations.find(
        (entry) =>
          entry.reservationId ===
          reservationId,
      );

    if (
      reservation &&
      reservation.quantity ===
        quantity &&
      reservation.status ===
        "confirmed"
    ) {
      return {
        success: true,
        alreadyConfirmed: true,
        inventory: existing,
      };
    }

    return {
      success: false,

      reason:
        reservation?.status ===
        "released"
          ? "Reservation has already been released"
          : "Matching reserved inventory was not found",
    };
  };

/**
 * Release one product reservation.
 *
 * Only stock owned by this reservationId can
 * return to available stock.
 */
InventorySchema.statics.releaseReservation =
  async function ({
    productId,
    quantity,
    reservationId,
  }) {
    if (!reservationId || !Number.isInteger(quantity) || quantity < 1) {
      throw new Error("Invalid reservation release request");
    }
    const result =
      await this.findOneAndUpdate(
        {
          productId,

          reservations: {
            $elemMatch: {
              reservationId,
              quantity,
              status:
                "reserved",
            },
          },

          reservedStock: {
            $gte: quantity,
          },
        },

        {
          $inc: {
            availableStock:
              quantity,

            reservedStock:
              -quantity,
          },

          $set: {
            "reservations.$.status":
              "released",

            "reservations.$.updatedAt":
              new Date(),

            lastSync:
              new Date(),
          },
        },

        {
          new: true,
        },
      );

    if (result) {
      return {
        success: true,
        alreadyReleased: false,
        inventory: result,
      };
    }

    /*
     * A duplicate release request must not add
     * the stock twice.
     */
    const existing =
      await this.findOne({
        productId,
        "reservations.reservationId":
          reservationId,
      });

    const reservation =
      existing?.reservations.find(
        (entry) =>
          entry.reservationId ===
          reservationId,
      );

    if (
      reservation &&
      reservation.quantity ===
        quantity &&
      reservation.status ===
        "released"
    ) {
      return {
        success: true,
        alreadyReleased: true,
        inventory: existing,
      };
    }

    return {
      success: false,

      reason:
        reservation?.status ===
        "confirmed"
          ? "Confirmed inventory cannot be released"
          : "Matching reserved inventory was not found",
    };
  };

/**
 * Initialise inventory from the authoritative
 * product catalogue.
 *
 * IMPORTANT:
 * Existing stock values and reservation ledgers
 * are deliberately not overwritten on startup.
 */
InventorySchema.statics.syncFromCatalog =
  async function (
    productCatalog,
  ) {
    const operations = [];

    for (const product of Object.values(
      productCatalog,
    )) {
      operations.push({
        updateOne: {
          filter: {
            productId:
              product.id,
          },

          update: {
            $setOnInsert: {
              productId:
                product.id,

              name:
                product.name,

              sku:
                product.sku ||
                `SKU-${product.id}`,

              totalStock:
                product.inventory ||
                0,

              availableStock:
                product.inventory ||
                0,

              reservedStock: 0,

              reservations: [],

              lowStockThreshold:
                10,
            },

            /*
             * Product identity may be refreshed
             * without touching live stock counts.
             */
            $set: {
              name:
                product.name,

              sku:
                product.sku ||
                `SKU-${product.id}`,

              lastSync:
                new Date(),
            },
          },

          upsert: true,
        },
      });
    }

    if (
      operations.length > 0
    ) {
      await this.bulkWrite(
        operations,
      );

      console.log(
        `Inventory synced: ${operations.length} products`,
      );
    }

    return operations.length;
  };

const Inventory =
  mongoose.model(
    "Inventory",
    InventorySchema,
  );

export default Inventory;
