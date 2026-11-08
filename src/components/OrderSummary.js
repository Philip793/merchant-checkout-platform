import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext.js";
import { useAuth } from "../context/AuthContext.js";
import SEO from "./SEO.js";

const formatAudWithUsdEstimate = (amount) => {
  const aud = `$${amount.toFixed(2)} AUD`;
  return aud;
};

const emptyShippingAddress = {
  fullName: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  country: "AU",
  phone: "",
};

const getMissingAddressFields = (address) => {
  return ["fullName", "street", "city", "state", "zip"].filter(
    (field) => !String(address[field] || "").trim(),
  );
};

const OrderSummary = () => {
  const { cart, cartCount } = useCart();
  const { user, isAuthenticated, getToken, updateShippingAddress } =
    useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shippingAddress, setShippingAddress] = useState({
    ...emptyShippingAddress,
    fullName: user?.name || "",
    ...(user?.shippingAddress || {}),
  });

  useEffect(() => {
    if (user?.shippingAddress) {
      setShippingAddress((current) => ({
        ...current,
        ...user.shippingAddress,
      }));
    } else if (user?.name) {
      setShippingAddress((current) => ({
        ...current,
        fullName: current.fullName || user.name,
      }));
    }
  }, [user]);

  const shippingCountry = shippingAddress.country;

  // Calculate totals
  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  // US shipping must be quoted by the backend; do not display a false AUD total.
  const shipping = shippingCountry === "US" ? null : (cart.length > 0 ? 10 : 0);
  const total = shipping === null ? null : subtotal + shipping;

  // Prepare cart items for backend
  const cartItems = cart.map((item) => ({
    id: item.id,
    quantity: item.quantity,
  }));

  const handleProceedToCheckout = async () => {
  if (cart.length === 0) {
    setError("Your cart is empty");
    return;
  }

  if (!isAuthenticated()) {
    navigate("/login", { state: { from: { pathname: "/order-summary" } } });
    return;
  }

  const missingFields = getMissingAddressFields(shippingAddress);
  if (missingFields.length > 0) {
    setError("Please complete all required shipping address fields.");
    return;
  }

  setLoading(true);
  setError(null);

  try {
    const saveAddress = await updateShippingAddress(shippingAddress);

    if (!saveAddress.success) {
      if (saveAddress.authExpired) {
        navigate("/login", {
          state: { from: { pathname: "/order-summary" } },
        });
        return;
      }

      throw new Error(saveAddress.error);
    }

    const savedUser = saveAddress.user || user;

    const quoteResponse = await fetch(
      `${process.env.REACT_APP_API_URL || "http://localhost:4242"}/checkout/quote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ cartItems, shippingAddress }),
      },
    );
    const quote = await quoteResponse.json();
    if (!quoteResponse.ok || !quote.quoteToken) {
      throw new Error(quote.error || "Unable to calculate the current shipping rate");
    }

    const checkoutOrderSummary = {
      ...quote.orderSummary,
      cartItems,
      quoteToken: quote.quoteToken,

      customer: {
        email: savedUser?.email,
        name: shippingAddress.fullName || savedUser?.name,
      },

      shippingAddress,
    };

    navigate("/checkout", {
      state: {
        orderSummary: checkoutOrderSummary,
      },
    });
  } catch (err) {
    console.error("Checkout preparation error:", err);
    setError(err.message || "Failed to continue to checkout. Please try again.");
  } finally {
    setLoading(false);
  }
};

  const handleAddressChange = (field, value) => {
    setShippingAddress((current) => ({
      ...current,
      [field]: value,
    }));
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-6xl mb-4">🛒</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Your Cart is Empty
            </h1>
            <p className="text-gray-600 mb-6">
              Looks like you haven't added any items to your cart yet.
            </p>
            <button
              onClick={() => navigate("/shop")}
              className="px-6 py-3 bg-burgundy-600 text-white rounded-md hover:bg-burgundy-700 transition-colors font-semibold"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Order Summary - Review Your Order"
        description="Review your order before checkout. Secure payment with Stripe or PayPal."
      />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            Order Summary
          </h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Order Items */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Items ({cartCount})
                  </h2>
                </div>

                <div className="divide-y">
                  {cart.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="p-6 flex gap-4">
                      <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={item.images?.thumbnail || item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-grow">
                        <h3 className="font-semibold text-gray-800 mb-1">
                          {item.name}
                        </h3>
                        <p className="text-gray-600 text-sm mb-2">
                          ${item.price.toFixed(2)} each
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">
                            Qty: {item.quantity}
                          </span>
                          <span className="font-semibold text-gray-800">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping Info */}
              <div className="bg-white rounded-lg shadow-md mt-6 p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Shipping Address
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
                  <label className="block sm:col-span-2">
                    <span className="block font-medium text-gray-700 mb-2">
                      Full name
                    </span>
                    <input
                      type="text"
                      value={shippingAddress.fullName}
                      onChange={(event) =>
                        handleAddressChange("fullName", event.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-burgundy-500 focus:outline-none focus:ring-2 focus:ring-burgundy-200"
                      required
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="block font-medium text-gray-700 mb-2">
                      Street address
                    </span>
                    <input
                      type="text"
                      value={shippingAddress.street}
                      onChange={(event) =>
                        handleAddressChange("street", event.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-burgundy-500 focus:outline-none focus:ring-2 focus:ring-burgundy-200"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="block font-medium text-gray-700 mb-2">
                      City / suburb
                    </span>
                    <input
                      type="text"
                      value={shippingAddress.city}
                      onChange={(event) =>
                        handleAddressChange("city", event.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-burgundy-500 focus:outline-none focus:ring-2 focus:ring-burgundy-200"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="block font-medium text-gray-700 mb-2">
                      State
                    </span>
                    <input
                      type="text"
                      value={shippingAddress.state}
                      onChange={(event) =>
                        handleAddressChange("state", event.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-burgundy-500 focus:outline-none focus:ring-2 focus:ring-burgundy-200"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="block font-medium text-gray-700 mb-2">
                      Postcode / ZIP
                    </span>
                    <input
                      type="text"
                      value={shippingAddress.zip}
                      onChange={(event) =>
                        handleAddressChange("zip", event.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-burgundy-500 focus:outline-none focus:ring-2 focus:ring-burgundy-200"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="block font-medium text-gray-700 mb-2">
                      Country
                    </span>
                    <select
                      value={shippingAddress.country}
                      onChange={(event) =>
                        handleAddressChange("country", event.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-burgundy-500 focus:outline-none focus:ring-2 focus:ring-burgundy-200"
                    >
                      <option value="AU">Australia</option>
                      <option value="US">United States</option>
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="block font-medium text-gray-700 mb-2">
                      Phone number
                    </span>
                    <input
                      type="tel"
                      value={shippingAddress.phone}
                      onChange={(event) =>
                        handleAddressChange("phone", event.target.value)
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-burgundy-500 focus:outline-none focus:ring-2 focus:ring-burgundy-200"
                    />
                  </label>
                  <p className="sm:col-span-2">
                    Prices are charged in AUD. For US shipping, USD $30 is converted
                    at the current published exchange rate shown on the next checkout screen.
                    Your bank may apply its own fees.
                  </p>
                </div>
              </div>
            </div>

            {/* Order Total */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
                <h2 className="text-xl font-semibold text-gray-800 mb-6">
                  Order Total
                </h2>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>
                      {formatAudWithUsdEstimate(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span>
                      {shipping === null ? "USD $30 (AUD quote at checkout)" : formatAudWithUsdEstimate(shipping)}
                    </span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-bold text-gray-800">
                      <span>Total</span>
                      <span>
                        {total === null ? "Calculated at checkout" : formatAudWithUsdEstimate(total)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Charged in AUD at checkout
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleProceedToCheckout}
                  disabled={loading}
                  className="w-full py-3 bg-burgundy-600 text-white rounded-md hover:bg-burgundy-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin h-5 w-5 mr-2"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    "Proceed to Checkout"
                  )}
                </button>

                <div className="mt-4 text-center">
                  <button
                    onClick={() => navigate("/shop")}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Continue Shopping
                  </button>
                </div>

                {/* Payment Methods */}
                <div className="mt-6 pt-6 border-t">
                  <p className="text-xs text-gray-500 text-center mb-3">
                    Secure checkout with
                  </p>
                  <div className="flex justify-center gap-4">
                    <div className="flex items-center gap-1">
                      <span className="text-blue-600 font-bold">Stripe</span>
                    </div>
                    <span className="text-gray-300">|</span>
                    <div className="flex items-center gap-1">
                      <span className="text-blue-800 font-bold">PayPal</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default OrderSummary;
