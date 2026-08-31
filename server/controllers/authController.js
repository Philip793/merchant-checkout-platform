import jwt from "jsonwebtoken";
import User from "../models/User.js";
import LoginAttempt from "../models/LoginAttempt.js";

// Lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 5;
const ATTEMPT_WINDOW_MINUTES = 5;

// Security-critical configuration
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!JWT_SECRET) {
  throw new Error(
    "Missing JWT_SECRET environment variable. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
  );
}

/*
 * Initialize admin account if credentials
 * have been explicitly configured.
 */
export const initAdmin = async () => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log(
      "ℹ️ Admin credentials not set (ADMIN_EMAIL, ADMIN_PASSWORD) - skipping auto-initialization",
    );

    console.log(
      "To create an admin, set both variables in your .env file",
    );

    return;
  }

  try {
    const adminExists = await User.findOne({
      email: ADMIN_EMAIL,
    });

    if (!adminExists) {
      await User.create({
        name: "Admin",
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role: "admin",
      });

      console.log(
        "✅ Admin user initialized in database",
      );
    }
  } catch (error) {
    console.error(
      "❌ Failed to initialize admin:",
      error.message,
    );
  }
};

const JWT_EXPIRES_IN = "7d";

/*
 * Public user object returned to frontend.
 */
const normalizeUser = (user) => ({
  id: user._id.toString(),
  email: user.email,
  name: user.name,
  role: user.role,
  shippingAddress: user.shippingAddress,
});

const normalizeShippingAddress = (
  address = {},
) => {
  return {
    fullName: String(
      address.fullName || "",
    ).trim(),

    street: String(
      address.street || "",
    ).trim(),

    city: String(
      address.city || "",
    ).trim(),

    state: String(
      address.state || "",
    ).trim(),

    zip: String(
      address.zip || "",
    ).trim(),

    country: String(
      address.country || "AU",
    )
      .trim()
      .toUpperCase(),

    phone: String(
      address.phone || "",
    ).trim(),
  };
};

const validateShippingAddress = (
  address,
) => {
  const requiredFields = [
    "fullName",
    "street",
    "city",
    "state",
    "zip",
  ];

  const missing =
    requiredFields.filter(
      (field) => !address[field],
    );

  if (missing.length > 0) {
    return `Missing shipping address fields: ${missing.join(
      ", ",
    )}`;
  }

  if (
    !["AU", "US"].includes(
      address.country,
    )
  ) {
    return "Shipping country must be Australia or United States";
  }

  return null;
};

/*
 * Generate JWT.
 *
 * userId is the security-critical addition.
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    },
  );
};

/*
 * Register customer.
 */
export const register = async (
  req,
  res,
) => {
  try {
    const {
      email,
      password,
      name,
    } = req.body;

    if (
      !email ||
      !password ||
      !name
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Email, password, and name are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error:
          "Password must be at least 6 characters",
      });
    }

    const existingUser =
      await User.findOne({
        email,
      });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error:
          "User already exists",
      });
    }

    const user =
      await User.create({
        email,
        password,
        name,
        role: "user",
      });

    const token =
      generateToken(user);

    console.log(
      `✅ New customer registered: ${email}`,
    );

    res.status(201).json({
      success: true,

      message:
        "User registered successfully",

      token,

      user:
        normalizeUser(user),
    });
  } catch (error) {
    console.error(
      "Registration error:",
      error,
    );

    res.status(500).json({
      success: false,
      error:
        "Registration failed",
    });
  }
};

/*
 * Get client IP.
 */
const getClientIP = (req) => {
  return (
    req.ip ||
    req.headers[
      "x-forwarded-for"
    ]
      ?.split(",")[0]
      ?.trim() ||
    req.connection
      ?.remoteAddress ||
    "unknown"
  );
};

/*
 * Determine whether an account
 * is currently locked.
 */
const isAccountLocked = async (
  email,
  ipAddress,
) => {
  const record =
    await LoginAttempt.findOne({
      email,
    });

  if (!record) {
    return {
      locked: false,
    };
  }

  if (
    record.lockoutUntil &&
    record.lockoutUntil >
      new Date()
  ) {
    const remainingMinutes =
      Math.ceil(
        (record.lockoutUntil -
          new Date()) /
          (1000 * 60),
      );

    return {
      locked: true,
      remainingMinutes,

      message:
        `Account locked. Try again in ${remainingMinutes} minute(s).`,
    };
  }

  const windowStart =
    new Date(
      Date.now() -
        ATTEMPT_WINDOW_MINUTES *
          60 *
          1000,
    );

  if (
    record.lastAttempt >
      windowStart &&
    record.attempts >=
      MAX_FAILED_ATTEMPTS
  ) {
    record.lockoutUntil =
      new Date(
        Date.now() +
          LOCKOUT_DURATION_MINUTES *
            60 *
            1000,
      );

    await record.save();

    return {
      locked: true,

      remainingMinutes:
        LOCKOUT_DURATION_MINUTES,

      message:
        `Account locked due to ${MAX_FAILED_ATTEMPTS} failed attempts. ` +
        `Try again in ${LOCKOUT_DURATION_MINUTES} minutes.`,
    };
  }

  if (
    record.lastAttempt <=
    windowStart
  ) {
    record.attempts = 0;
    record.lockoutUntil =
      null;

    await record.save();
  }

  return {
    locked: false,
  };
};

/*
 * Record failed login attempt.
 */
const recordFailedAttempt = async (
  email,
  ipAddress,
) => {
  const record =
    await LoginAttempt.findOneAndUpdate(
      {
        email,
      },

      {
        $inc: {
          attempts: 1,
        },

        $set: {
          lastAttempt:
            new Date(),

          ipAddress,
        },
      },

      {
        upsert: true,
        new: true,
      },
    );

  if (
    record.attempts >=
    MAX_FAILED_ATTEMPTS
  ) {
    record.lockoutUntil =
      new Date(
        Date.now() +
          LOCKOUT_DURATION_MINUTES *
            60 *
            1000,
      );

    await record.save();

    console.warn(
      `Account locked: ${email} after ${MAX_FAILED_ATTEMPTS} failed attempts`,
    );

    return {
      locked: true,

      remainingAttempts: 0,

      message:
        `Account locked due to ${MAX_FAILED_ATTEMPTS} failed attempts. ` +
        `Try again in ${LOCKOUT_DURATION_MINUTES} minutes.`,
    };
  }

  return {
    locked: false,

    remainingAttempts:
      MAX_FAILED_ATTEMPTS -
      record.attempts,

    message:
      `Invalid credentials. ` +
      `${
        MAX_FAILED_ATTEMPTS -
        record.attempts
      } attempt(s) remaining before lockout.`,
  };
};

/*
 * Clear failed login attempts after
 * successful authentication.
 */
const resetLoginAttempts = async (
  email,
) => {
  await LoginAttempt.findOneAndDelete({
    email,
  });
};

/*
 * Login.
 */
export const login = async (
  req,
  res,
) => {
  try {
    const {
      email,
      password,
    } = req.body;

    const ipAddress =
      getClientIP(req);

    if (
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Email and password are required",
      });
    }

    const lockStatus =
      await isAccountLocked(
        email,
        ipAddress,
      );

    if (lockStatus.locked) {
      return res.status(423).json({
        success: false,

        error:
          lockStatus.message,

        locked: true,

        remainingMinutes:
          lockStatus.remainingMinutes,
      });
    }

    const user =
      await User.findOne({
        email,
      });

    if (!user) {
      const attemptStatus =
        await recordFailedAttempt(
          email,
          ipAddress,
        );

      return res.status(401).json({
        success: false,

        error:
          attemptStatus.locked
            ? attemptStatus.message
            : "Invalid credentials",

        remainingAttempts:
          attemptStatus.remainingAttempts,

        locked:
          attemptStatus.locked,

        ...(attemptStatus.locked && {
          remainingMinutes:
            LOCKOUT_DURATION_MINUTES,
        }),
      });
    }

    const isValidPassword =
      await user.comparePassword(
        password,
      );

    if (!isValidPassword) {
      const attemptStatus =
        await recordFailedAttempt(
          email,
          ipAddress,
        );

      console.warn(
        `⚠️ Failed login attempt for: ${email} from IP: ${ipAddress}`,
      );

      return res.status(401).json({
        success: false,

        error:
          attemptStatus.message,

        remainingAttempts:
          attemptStatus.remainingAttempts,

        locked:
          attemptStatus.locked,

        ...(attemptStatus.locked && {
          remainingMinutes:
            LOCKOUT_DURATION_MINUTES,
        }),
      });
    }

    await resetLoginAttempts(
      email,
    );

    const token =
      generateToken(user);

    console.log(
      `✅ User logged in: ${email} (${user.role}) from IP: ${ipAddress}`,
    );

    res.json({
      success: true,

      message:
        "Login successful",

      token,

      user:
        normalizeUser(user),
    });
  } catch (error) {
    console.error(
      "Login error:",
      error,
    );

    res.status(500).json({
      success: false,
      error:
        "Login failed",
    });
  }
};

/*
 * Get current user.
 */
export const getMe = async (
  req,
  res,
) => {
  try {
    /*
     * New JWTs contain userId.
     * Email fallback is retained temporarily
     * for tokens issued before this change.
     */
    const user =
      req.user.userId
        ? await User.findById(
            req.user.userId,
          ).select("-password")
        : await User.findOne({
            email:
              req.user.email,
          }).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        error:
          "User not found",
      });
    }

    res.json({
      success: true,

      user:
        normalizeUser(user),
    });
  } catch (error) {
    console.error(
      "Get user error:",
      error,
    );

    res.status(500).json({
      success: false,
      error:
        "Failed to get user",
    });
  }
};

/*
 * Save default shipping address.
 */
export const updateShippingAddress =
  async (req, res) => {
    try {
      const address =
        normalizeShippingAddress(
          req.body
            .shippingAddress ||
            req.body,
        );

      const validationError =
        validateShippingAddress(
          address,
        );

      if (validationError) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              validationError,
          });
      }

      /*
       * Prefer immutable user ID for new JWTs.
       * Retain email fallback for existing tokens.
       */
      const query =
        req.user.userId
          ? {
              _id:
                req.user.userId,
            }
          : {
              email:
                req.user.email,
            };

      const user =
        await User.findOneAndUpdate(
          query,

          {
            shippingAddress:
              address,
          },

          {
            new: true,
            runValidators: true,
          },
        ).select("-password");

      if (!user) {
        return res
          .status(404)
          .json({
            success: false,
            error:
              "User not found",
          });
      }

      res.json({
        success: true,

        user:
          normalizeUser(user),
      });
    } catch (error) {
      console.error(
        "Update shipping address error:",
        error,
      );

      res.status(500).json({
        success: false,

        error:
          "Failed to save shipping address",
      });
    }
  };

/*
 * Logout.
 *
 * Authentication currently uses bearer
 * tokens, so the frontend removes the token.
 */
export const logout = async (
  req,
  res,
) => {
  console.log(
    `User logged out: ${req.user?.email}`,
  );

  res.json({
    success: true,
    message:
      "Logout successful",
  });
};

/*
 * authMiddleware.js imports this value.
 */
export { JWT_SECRET };