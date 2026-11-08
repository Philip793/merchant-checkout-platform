import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { JWT_SECRET } from "../controllers/authController.js";

/**
 * Verify JWT token from Authorization header
 */
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Access denied. No token provided.",
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication failed",
    });
  }
};

/**
 * Check if user has admin role
 */
export const requireAdmin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }

  try {
    const account = await User.findById(req.user.userId).select("role").lean();
    if (account?.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Admin access required",
    });
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication - attaches user if token valid, but doesn't require it
 */
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
      } catch {
        // Invalid token, continue without user
      }
    }

    next();
  } catch (error) {
    console.error("Optional auth error:", error);
    next();
  }
};

export default {
  authenticate,
  requireAdmin,
  optionalAuth,
};
