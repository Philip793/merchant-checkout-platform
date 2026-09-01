import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import BraintreeDropInModule from "braintree-web-drop-in-react";
import {
  PaymentElement,
  useStripe,
  useElements,
  Elements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useCart } from "../context/CartContext.js";
import { useAuth } from "../context/AuthContext.js";
import SEO from "./SEO.js";

// -----------------------------
// Initialize Stripe SDK with publishable key
// REACT_APP_STRIPE_PUBLISHABLE_KEY must be set in root .env file
// -----------------------------
const stripeKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;


if (!stripeKey) {
  throw new Error(
    "Missing REACT_APP_STRIPE_PUBLISHABLE_KEY environment variable. Please set it in your .env file.",
  );
}

const stripePromise = loadStripe(stripeKey);
const BraintreeDropIn = BraintreeDropInModule.default;

// -----------------------------
// Stripe Checkout Form Component
// -----------------------------
const StripeCheckoutForm = ({ orderSummary, pendingOrderId }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setMessage(null);

    try {
      // Save order summary to sessionStorage in case Stripe redirects
      // (redirects lose navigation state, so we need a backup)
      sessionStorage.setItem(
        "pendingOrderSummary",
        JSON.stringify(orderSummary),
      );
      if (pendingOrderId) {
        sessionStorage.setItem("pendingOrderId", pendingOrderId);
      }

      // Confirm payment with Stripe
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success`,
        },
        redirect: "if_required",
      });

      if (error) {
        setMessage(error.message);
        // If payment failed, redirect to cancel page
        if (error.type === "card_error" || error.type === "validation_error") {
          navigate("/checkout/cancel", { state: { error: error.message } });
        }
      } else if (paymentIntent) {
        // Payment successful - use the REAL PaymentIntent ID from Stripe
        console.log("✅ Payment successful with ID:", paymentIntent.id);
        navigate("/checkout/success", {
          state: {
            orderSummary,
            pendingOrderId,
            transactionId: paymentIntent.id, // REAL Stripe PaymentIntent ID
          },
        });
      } else {
        // If no paymentIntent and no error, Stripe may have redirected
        // The success page will handle URL-based extraction
        console.log("⏳ Redirecting to success page...");
      }
    } catch (err) {
      setMessage("Payment failed. Please try again.");
      navigate("/checkout/cancel", { state: { error: err.message } });
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-sm text-gray-600 mb-2">Amount to pay:</p>
        <p className="text-2xl font-bold text-gray-800">
          ${orderSummary?.total || "0.00"} AUD
        </p>
      </div>
      <PaymentElement />
      <button
        disabled={loading || !stripe || !elements}
        className="w-full py-3 bg-burgundy-600 text-white rounded-md hover:bg-burgundy-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
      >
        {loading ? "Processing..." : `Pay ${orderSummary?.total || ""} AUD`}
      </button>
      {message && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
          {message}
        </div>
      )}
    </form>
  );
};

// -----------------------------
// Main Checkout Page (Stripe + Braintree integration)
// -----------------------------
const CheckoutPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cart } = useCart();
const {
  isAuthenticated,
  loading: authLoading,
  getToken,
  user,
  logout,
} = useAuth();
  const isLoggedIn = isAuthenticated();

  // Get checkout session data from OrderSummary page
const initialOrderSummary = location.state?.orderSummary;

const [orderSummary, setOrderSummary] = useState(initialOrderSummary);
const [clientSecret, setClientSecret] = useState(
  location.state?.clientSecret || null,
);
const [pendingOrderId, setPendingOrderId] = useState(
  location.state?.pendingOrderId || null,
);
const [stripeLoading, setStripeLoading] = useState(false);
const [stripeError, setStripeError] = useState(null);

  // Braintree state - MUST be before any early returns
  const [braintreeToken, setBraintreeToken] = useState(null);
  const [braintreeInstance, setBraintreeInstance] = useState(null);
  const [braintreeLoading, setBraintreeLoading] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if no checkout session (user navigated directly to /checkout)
useEffect(() => {
  if (!authLoading && !orderSummary) {
    navigate("/order-summary");
  }
}, [authLoading, orderSummary, navigate]);

  // Fetch Braintree token on mount

useEffect(() => {
  if (!isLoggedIn) {
    return;
  }

  const loadBraintreeToken =
    async () => {
      try {
        const token = getToken();

        if (!token) {
          setError(
            "Your login session has expired. Please log in again.",
          );

          return;
        }

        const response =
          await fetch(
            `${
              process.env
                .REACT_APP_API_URL ||
              "http://localhost:4242"
            }/braintree/token`,
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              cache: "no-store",
            },
          );

        const data =
          await response.json();

        /*
         * If authentication has expired,
         * remove the stale local session and
         * return the customer to login.
         */
        if (response.status === 401) {
          logout();

          navigate("/login", {
            state: {
              from: {
                pathname:
                  "/checkout",
              },
            },
          });

          return;
        }

        if (
          !response.ok ||
          !data.clientToken
        ) {
          throw new Error(
            data.error ||
              "Unable to initialize PayPal",
          );
        }

        setBraintreeToken(
          data.clientToken,
        );
      } catch (err) {
        console.error(
          "Failed to load Braintree token:",
          err,
        );

        setError(
          "Failed to load PayPal. Please refresh the page.",
        );
      }
    };

  loadBraintreeToken();

  /*
   * Deliberately depend only on login state.
   *
   * getToken/logout are currently recreated
   * by AuthContext on each render, so putting
   * them in this dependency array would cause
   * unnecessary repeated token requests.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isLoggedIn]);

  // Redirect to login if not authenticated - after all hooks
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <Navigate
        to="/login"
        state={{ from: { pathname: "/checkout" } }}
        replace
      />
    );
  }
const createStripePaymentIntent = async () => {
  if (!orderSummary) return;

  setStripeLoading(true);
  setStripeError(null);

  try {
    const token = getToken();

    const cartItemsForBackend =
      orderSummary.cartItems ||
      cart.map((item) => ({
        id: item.id,
        quantity: item.quantity,
      }));

    const response = await fetch(
      `${process.env.REACT_APP_API_URL || "http://localhost:4242"}/create-checkout-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cartItems: cartItemsForBackend,
          shippingCountry: orderSummary.shippingCountry || "AU",
          customer: {
            email: orderSummary.customer?.email || user?.email,
            name:
              orderSummary.shippingAddress?.fullName ||
              orderSummary.customer?.name ||
              user?.name,
          },
          shippingAddress: orderSummary.shippingAddress,
        }),
      },
    );

    const data = await response.json();

    if (response.status === 401) {
      logout();
      navigate("/login", { state: { from: { pathname: "/checkout" } } });
      return;
    }

    if (!response.ok || data.error) {
      throw new Error(data.error || "Failed to start card payment.");
    }

    setClientSecret(data.clientSecret);
    setPendingOrderId(data.pendingOrderId);

    setOrderSummary({
      ...data.orderSummary,
      cartItems: cartItemsForBackend,
      customer: {
        email: orderSummary.customer?.email || user?.email,
        name:
          orderSummary.shippingAddress?.fullName ||
          orderSummary.customer?.name ||
          user?.name,
      },
      shippingAddress: orderSummary.shippingAddress,
    });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    setStripeError(err.message || "Failed to prepare card payment.");
  } finally {
    setStripeLoading(false);
  }
};
  // Handle Braintree (PayPal) payment with cart data
  const handleBraintreePurchase = async () => {
    if (!braintreeInstance || cart.length === 0) return;
    setBraintreeLoading(true);
    setError(null);

    try {
      const { nonce } = await braintreeInstance.requestPaymentMethod();

      // Prepare cart items for backend (only id and quantity)
      const cartItems = cart.map((item) => ({
        id: item.id,
        quantity: item.quantity,
      }));

      // Send to secure endpoint that calculates total on backend
      const res = await fetch(
  `${process.env.REACT_APP_API_URL || "http://localhost:4242"}/braintree/checkout-with-cart`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      nonce,
      cartItems,
      shippingCountry: orderSummary?.shippingCountry || "AU",
      customer: {
        email: user?.email,
        name: orderSummary?.shippingAddress?.fullName || user?.name,
      },
      shippingAddress: orderSummary?.shippingAddress,
    }),
  }
);
      const data = await res.json();

      if (data.success) {
        // Navigate to success page with order details
        navigate("/checkout/success", {
  state: {
    orderSummary: data.orderSummary,
    transactionId: data.transactionId,
    orderId: data.orderId,
  },
});
      } else {
        // Navigate to cancel page with error
        navigate("/checkout/cancel", { state: { error: data.error } });
      }
    } catch (err) {
      navigate("/checkout/cancel", { state: { error: err.message } });
    }

    setBraintreeLoading(false);
  };

  // Stripe Elements options
  const appearance = { theme: "stripe" };
 

if (!orderSummary) {
  return null;
}

  return (
    <>
      <SEO
        title="Checkout - Secure Payment"
        description="Complete your purchase securely with Stripe or PayPal."
      />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            Checkout
          </h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Order Summary */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Order Summary
              </h2>

              <div className="space-y-3 mb-4">
                {orderSummary.items?.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {item.name} x {item.quantity}
                    </span>
                    <span className="font-medium">${item.total}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>${orderSummary.subtotal}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Shipping</span>
                  <span>${orderSummary.shipping}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t">
                  <span>Total</span>
                  <span>${orderSummary.total} AUD</span>
                </div>
              </div>

              <button
                onClick={() => navigate("/order-summary")}
                className="mt-6 text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to Order Summary
              </button>
            </div>

            {/* Payment Options */}
            <div className="space-y-6">
              {/* PayPal Section */}
              {braintreeToken && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    Pay with PayPal
                  </h2>
                  <BraintreeDropIn
                    options={{
                      authorization: braintreeToken,
                      paypal: {
                        flow: "checkout",
                        amount: orderSummary.total,
                        currency: "AUD",
                        buttonStyle: {
                          color: "blue",
                          shape: "rect",
                          size: "medium",
                          label: "paypal",
                        },
                        singleUse: true,
                      },
                    }}
                    onInstance={(instance) => setBraintreeInstance(instance)}
                  />
                  <button
                    onClick={handleBraintreePurchase}
                    disabled={braintreeLoading}
                    className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold mt-4"
                  >
                    {braintreeLoading
                      ? "Processing..."
                      : `Pay ${orderSummary.total} AUD with PayPal`}
                  </button>
                </div>
              )}

              {/* Stripe Section */}
              <div className="bg-white rounded-lg shadow-md p-6">
  <h2 className="text-lg font-semibold text-gray-800 mb-4">
    Pay with Card
  </h2>

  {!clientSecret ? (
    <>
      <p className="text-sm text-gray-600 mb-4">
        Select this option to securely pay by card.
      </p>

      <button
        onClick={createStripePaymentIntent}
        disabled={stripeLoading}
        className="w-full py-3 bg-burgundy-600 text-white rounded-md hover:bg-burgundy-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
      >
        {stripeLoading
          ? "Preparing card payment..."
          : `Continue with Card - ${orderSummary?.total || ""} AUD`}
      </button>

      {stripeError && (
        <div className="mt-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
          {stripeError}
        </div>
      )}
    </>
  ) : (
    <Elements options={{ clientSecret, appearance }} stripe={stripePromise}>
      <StripeCheckoutForm
        orderSummary={orderSummary}
        pendingOrderId={pendingOrderId}
      />
    </Elements>
  )}
</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CheckoutPage;
