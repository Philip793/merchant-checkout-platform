// Import dependencies
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import { v4 as uuidv4 } from "uuid";

import paymentRoutes from "./routes/payments.js";
import productRoutes from "./routes/products.js";

import connectDB from "./config/database.js";
import productCatalog from "./data/productCatalog.js";
import { validateProductCatalog } from "./middleware/productValidation.js";
import { initializeInventory } from "./services/inventoryService.js";
import { initAdmin } from "./controllers/authController.js";
import sanitizeInput from "./middleware/validateInput.js";
import { handleStripeWebhook } from "./controllers/stripeController.js";

// Load environment variables from .env file
dotenv.config();

// Validate the authoritative product catalogue on startup.
// productCatalog.js is now the single source of truth for:
// - product names
// - prices
// - SKUs
// - descriptions
// - images
// - other product metadata
validateProductCatalog(productCatalog);

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB()
  .then(() => {
    // Initialize admin user after DB connection is established
    initAdmin();
  })
  .catch((err) => {
    console.error(
      "⚠️ Database connection failed:",
      err.message,
    );
  });

// Initialize inventory from the authoritative product catalogue.
//
// The catalogue provides the initial product definitions,
// while MongoDB remains responsible for live inventory levels.
initializeInventory().catch((err) => {
  console.error(
    "⚠️ Inventory initialization failed:",
    err.message,
  );
});

// Trust proxy settings for accurate IP detection behind load balancers.
//
// In production:
// Trust the first proxy, such as Railway/load balancer.
//
// In development:
// Trust loopback only.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);

  // HTTPS enforcement in production.
  app.use((req, res, next) => {
    if (
      req.header("x-forwarded-proto") !==
      "https"
    ) {
      return res.redirect(
        `https://${req.header("host")}${req.url}`,
      );
    }

    next();
  });
} else {
  app.set("trust proxy", "loopback");
}

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: [
          "'self'",
          "https://js.stripe.com",
          "'wasm-unsafe-eval'",
        ],

        frameSrc: [
          "'self'",
          "https://js.stripe.com",
          "https://hooks.stripe.com",
        ],

        connectSrc: [
          "'self'",
          "https://api.stripe.com",
          "https://m.stripe.network",
          "https://r.stripe.com",
        ],

        imgSrc: [
          "'self'",
          "data:",
          "https:",
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'",
        ],
      },
    },

    crossOriginEmbedderPolicy: false,
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message:
    "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message:
    "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);
app.use("/auth/", authLimiter);

// MongoDB sanitisation.
//
// NOTE:
// We are leaving the middleware ordering unchanged for now
// because fixing sanitisation order is a separate HIGH-priority
// issue that we will address later.
app.use((req, res, next) => {
  if (req.body) {
    req.body = mongoSanitize.sanitize(
      req.body,
      {
        replaceWith: "_",

        onSanitize: ({ key }) => {
          console.warn(
            `⚠️ Sanitized malicious input: ${key} from ${req.ip}`,
          );
        },
      },
    );
  }

  next();
});

// Prevent HTTP Parameter Pollution
app.use(
  hpp({
    whitelist: [
      "price",
      "category",
      "sort",
    ],
  }),
);

// Configure CORS
app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      "http://localhost:3000",

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  }),
);

// Stripe webhooks require the raw request body
// so Stripe's webhook signature can be verified.
//
// IMPORTANT:
// This must remain before bodyParser.json().
app.post(
  "/webhooks/stripe",
  bodyParser.raw({
    type: "application/json",
  }),
  handleStripeWebhook,
);

// Parse JSON request bodies.
// Limit request size to reduce abuse.
app.use(
  bodyParser.json({
    limit: "10kb",
  }),
);

// Add a request ID for debugging and audit trails.
app.use((req, res, next) => {
  req.id =
    req.headers["x-request-id"] ||
    uuidv4();

  res.setHeader(
    "X-Request-ID",
    req.id,
  );

  next();
});

// General input sanitization middleware
app.use(sanitizeInput);

// ----------------------------------------------------
// Routes
// ----------------------------------------------------

// Public, read-only product catalogue.
//
// GET /products
// GET /products/:productId
//
// These routes return product information from the
// authoritative server-side product catalogue.
// Live available stock is added from MongoDB.
app.use(
  "/products",
  productRoutes,
);

// Payment, authentication, order and other existing routes.
app.use(
  "/",
  paymentRoutes,
);

// Health check endpoint
app.get(
  "/health",
  (req, res) => {
    res.send({
      status: "ok",
      timestamp:
        new Date().toISOString(),
    });
  },
);

// Global error handler.
//
// Prevent stack traces from being exposed in production.
app.use(
  (err, req, res, next) => {
    console.error(
      "Error:",
      err,
    );

    const isDev =
      process.env.NODE_ENV ===
      "development";

    res
      .status(err.status || 500)
      .json({
        success: false,

        error:
          err.message ||
          "Internal server error",

        ...(isDev && {
          stack: err.stack,
        }),
      });
  },
);

// ----------------------------------------------------
// Start server
// ----------------------------------------------------

const PORT =
  process.env.SERVER_PORT ||
  4242;

const isDev =
  process.env.NODE_ENV !==
  "production";

app.listen(
  PORT,
  () => {
    console.log(
      `Server running on port ${PORT}`,
    );

    console.log(
      `Environment: ${
        process.env.NODE_ENV ||
        "development"
      }`,
    );

    console.log(
      `Security: ${
        isDev
          ? "HTTP (dev mode)"
          : "HTTPS required"
      }`,
    );

    console.log(
      "\n🛍️ Product Endpoints:",
    );

    console.log(
      "   GET  /products             - Public product catalogue",
    );

    console.log(
      "   GET  /products/:productId  - Public individual product",
    );

    console.log(
      "\n✅ Available Payment Endpoints:",
    );

    console.log(
      "   POST /create-checkout-session  - Stripe checkout (server-calculated amount)",
    );

    console.log(
      "   POST /braintree/checkout-with-cart - Braintree checkout (server-calculated amount)",
    );

    console.log(
      "   POST /confirm-payment - Validates Stripe payment before order creation",
    );

    console.log(
      "   GET  /braintree/token - Braintree client token",
    );

    console.log(
      "\n🗑️ Removed Legacy Endpoints:",
    );

    console.log(
      "   POST /create-payment-intent - Accepted amount from frontend (REMOVED)",
    );

    console.log(
      "   POST /braintree/checkout - Accepted amount from frontend (REMOVED)",
    );

    console.log("");
  },
);

export default app;