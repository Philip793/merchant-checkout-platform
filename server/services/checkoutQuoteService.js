import jwt from "jsonwebtoken";
import { calculateCartTotal, getShippingCountryFromAddress } from "../data/productCatalog.js";
import { getUsdToAudRate } from "./exchangeRateService.js";

const signingSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET must be configured");
  return process.env.JWT_SECRET;
};

export const cartFingerprint = (cartItems) => JSON.stringify(
  [...cartItems].map((item) => ({ id: Number(item.id), quantity: Number(item.quantity) }))
    .sort((a, b) => a.id - b.id),
);

export const createCheckoutQuote = async ({ cartItems, shippingAddress, userId }) => {
  const country = getShippingCountryFromAddress(shippingAddress);
  const fx = country === "US" ? await getUsdToAudRate() : null;
  const orderSummary = calculateCartTotal(cartItems, {
    shippingAddress,
    usdToAudRate: fx?.rate,
    exchangeRateDate: fx?.date,
  });
  const quoteToken = jwt.sign({
    purpose: "checkout_quote",
    userId: String(userId),
    cart: cartFingerprint(cartItems),
    country,
    fxRate: fx?.rate || null,
    fxDate: fx?.date || null,
    totalCents: orderSummary.totalCents,
  }, signingSecret(), { expiresIn: "10m" });
  return { orderSummary, quoteToken };
};

export const verifyCheckoutQuote = ({ quoteToken, cartItems, shippingAddress, userId }) => {
  if (!quoteToken || typeof quoteToken !== "string") throw new Error("A checkout quote is required");
  let quote;
  try { quote = jwt.verify(quoteToken, signingSecret()); }
  catch { throw new Error("Checkout quote expired or invalid. Please refresh your quote."); }
  const country = getShippingCountryFromAddress(shippingAddress);
  if (quote.purpose !== "checkout_quote" || quote.userId !== String(userId) ||
      quote.country !== country || quote.cart !== cartFingerprint(cartItems)) {
    throw new Error("Checkout details changed. Please refresh your quote.");
  }
  const orderSummary = calculateCartTotal(cartItems, {
    shippingAddress,
    usdToAudRate: quote.fxRate,
    exchangeRateDate: quote.fxDate,
  });
  if (orderSummary.totalCents !== quote.totalCents) throw new Error("Checkout quote no longer matches prices");
  return orderSummary;
};
