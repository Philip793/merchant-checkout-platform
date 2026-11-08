import Order from "../models/Order.js";

/**
 * Create a new order after successful payment.
 */
export const createOrder = async (
  orderData,
  options = {},
) => {
  try {
    /*
     * Every new customer order must have an
     * authenticated MongoDB account owner.
     */
    if (!orderData.userId) {
      throw new Error(
        "Cannot create order without userId",
      );
    }

    /*
     * Generate an orderId if one was not
     * already supplied.
     */
    if (!orderData.orderId) {
      orderData.orderId =
        `ORD-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 6)
          .toUpperCase()}`;
    }

    const order =
      new Order(orderData);

    await order.save();

    console.log(
      `✅ Order saved: ${order.orderId}`,
    );

    return order;
  } catch (error) {
    // A provider can deliver the same success twice concurrently. The unique
    // payment transaction index is authoritative; recover the winner.
    if (error.code === 11000 && orderData.payment?.transactionId) {
      const existing = await Order.findOne({
        "payment.transactionId": orderData.payment.transactionId,
        userId: orderData.userId,
      });
      if (existing) return existing;
    }
    console.error(
      "❌ Failed to save order:",
      error.message,
    );

    if (options.throwOnError) {
      throw error;
    }

    /*
     * Existing behaviour is retained for callers
     * that do not explicitly request an exception.
     */
    return null;
  }
};

/**
 * Get all orders.
 *
 * Route protection:
 * authenticate + requireAdmin
 */
export const getOrders = async (
  req,
  res,
) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      customerEmail,
    } = req.query;

    const safePage = Math.max(1, Math.min(100000, Number.parseInt(page, 10) || 1));
    const safeLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 20));

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (customerEmail) {
      filter["customer.email"] =
        customerEmail.toLowerCase();
    }

    const orders =
      await Order.find(filter)
        .sort({
          createdAt: -1,
        })
        .limit(safeLimit)
        .skip(
          (safePage - 1) * safeLimit,
        );

    const count =
      await Order.countDocuments(
        filter,
      );

    res.json({
      orders,

      totalPages:
        Math.ceil(
          count / safeLimit,
        ),

      currentPage: safePage,

      total: count,
    });
  } catch (error) {
    console.error(
      "❌ Get orders error:",
      error.message,
    );

    res.status(500).json({
      error:
        "Failed to retrieve orders",
    });
  }
};

/**
 * Get a single order.
 *
 * SECURITY:
 *
 * Admin:
 *   May retrieve any order.
 *
 * Customer:
 *   May retrieve an order only when BOTH:
 *
 *     orderId matches
 *     AND
 *     userId matches authenticated JWT userId
 *
 * We deliberately return 404 rather than 403
 * when another customer's order is requested.
 * This avoids confirming whether that order ID
 * exists.
 */
export const getOrderById = async (
  req,
  res,
) => {
  try {
    const {
      orderId,
    } = req.params;

    if (!orderId) {
      return res
        .status(400)
        .json({
          error:
            "Order ID is required",
        });
    }

    /*
     * Admins can retrieve any order.
     */
    if (
      req.user?.role ===
      "admin"
    ) {
      const order =
        await Order.findOne({
          orderId,
        });

      if (!order) {
        return res
          .status(404)
          .json({
            error:
              "Order not found",
          });
      }

      return res.json(order);
    }

    /*
     * Customer tokens must contain the
     * immutable MongoDB account ID.
     *
     * Existing JWTs created before this
     * security change will not have userId.
     */
    const authenticatedUserId =
      req.user?.userId;

    if (!authenticatedUserId) {
      return res
        .status(401)
        .json({
          success: false,

          error:
            "Your login session is outdated. Please log out and log in again.",
        });
    }

    /*
     * CRITICAL SECURITY CHECK
     *
     * Previously:
     *
     * Order.findOne({ orderId })
     *
     * Now:
     *
     * Order.findOne({
     *   orderId,
     *   userId: authenticatedUserId
     * })
     *
     * Authentication alone is not enough.
     * The authenticated account must also
     * own the requested order.
     */
    const order =
      await Order.findOne({
        orderId,

        userId:
          authenticatedUserId,
      });

    if (!order) {
      /*
       * Deliberately return the same response for:
       *
       * - order does not exist
       * - order belongs to another customer
       *
       * This prevents order enumeration.
       */
      return res
        .status(404)
        .json({
          error:
            "Order not found",
        });
    }

    return res.json(order);
  } catch (error) {
    console.error(
      "❌ Get order error:",
      error.message,
    );

    res.status(500).json({
      error:
        "Failed to retrieve order",
    });
  }
};

/**
 * Update order status.
 *
 * Route protection:
 * authenticate + requireAdmin
 */
export const updateOrderStatus =
  async (req, res) => {
    try {
      const {
        orderId,
      } = req.params;

      const {
        status,
      } = req.body;

      const validStatuses = [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ];

      if (
        !validStatuses.includes(
          status,
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid status",
          });
      }

      const order =
        await Order.findOneAndUpdate(
          {
            orderId,
          },

          {
            status,
          },

          {
            new: true,
          },
        );

      if (!order) {
        return res
          .status(404)
          .json({
            error:
              "Order not found",
          });
      }

      res.json(order);
    } catch (error) {
      console.error(
        "❌ Update order error:",
        error.message,
      );

      res.status(500).json({
        error:
          "Failed to update order",
      });
    }
  };

/**
 * Get order statistics.
 *
 * Route protection:
 * authenticate + requireAdmin
 */
export const getOrderStats =
  async (req, res) => {
    try {
      const stats =
        await Order.aggregate([
          {
            $group: {
              _id: null,

              totalOrders: {
                $sum: 1,
              },

              totalRevenue: {
                $sum:
                  "$total",
              },

              averageOrderValue: {
                $avg:
                  "$total",
              },
            },
          },
        ]);

      const statusCounts =
        await Order.aggregate([
          {
            $group: {
              _id:
                "$status",

              count: {
                $sum: 1,
              },
            },
          },
        ]);

      res.json({
        overview:
          stats[0] || {
            totalOrders: 0,
            totalRevenue: 0,
            averageOrderValue: 0,
          },

        statusCounts:
          statusCounts.reduce(
            (acc, curr) => {
              acc[curr._id] =
                curr.count;

              return acc;
            },
            {},
          ),
      });
    } catch (error) {
      console.error(
        "❌ Get stats error:",
        error.message,
      );

      res.status(500).json({
        error:
          "Failed to retrieve statistics",
      });
    }
  };

export default {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getOrderStats,
};
