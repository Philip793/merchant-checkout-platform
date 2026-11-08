import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext.js";
import { useAuth } from "../context/AuthContext.js";
import SEO from "./SEO.js";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:4242";

const PaymentSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [confirmationStatus, setConfirmationStatus] = useState("confirming");
  const [orderId, setOrderId] = useState(location.state?.orderId || null);
  const [errorMessage, setErrorMessage] = useState("");
  const hasStarted = useRef(false);

  const queryParams = new URLSearchParams(location.search);
  const urlPaymentIntent = queryParams.get("payment_intent");

  const orderSummary =
    location.state?.orderSummary ||
    (() => {
      try {
        const saved = sessionStorage.getItem("pendingOrderSummary");
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    })();

  const transactionId = urlPaymentIntent || location.state?.transactionId;
  const isStripePayment = transactionId?.startsWith("pi_");
  const braintreeOrderId = location.state?.orderId;

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    if (!transactionId) {
      setConfirmationStatus("error");
      setErrorMessage(
        "Payment verification details were not found. Please contact support if you were charged.",
      );
      return;
    }

    if (!isStripePayment) {
      // Braintree reaches this page only after its checkout endpoint
      // returned a successful recorded order.
      if (!braintreeOrderId) {
        setConfirmationStatus("error");
        setErrorMessage("Order confirmation is missing. Please contact support before retrying payment.");
        return;
      }
      clearCart();
      setConfirmationStatus("confirmed");
      sessionStorage.removeItem("pendingOrderSummary");
      sessionStorage.removeItem("pendingOrderId");
      return;
    }

    let cancelled = false;

    const checkOrderStatus = async () => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          const response = await fetch(`${API_URL}/confirm-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getTokenRef.current() || ""}`,
            },
            body: JSON.stringify({ paymentIntentId: transactionId }),
          });

          const data = await response.json();

          if (cancelled) return;

          if (response.ok && data.orderCreated) {
            clearCart();
            setOrderId(data.orderId);
            setConfirmationStatus("confirmed");
            sessionStorage.removeItem("pendingOrderSummary");
            sessionStorage.removeItem("pendingOrderId");
            return;
          }

          if (data.status && data.status !== "succeeded") {
            setConfirmationStatus("error");
            setErrorMessage(
              `Payment status is ${data.status}. Please contact support if you were charged.`,
            );
            return;
          }
        } catch (error) {
          if (attempt === 5) {
            setConfirmationStatus("error");
            setErrorMessage(
              "Payment succeeded, but we could not confirm the order status. Please contact support with your transaction ID.",
            );
            return;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (!cancelled) {
        setConfirmationStatus("pending");
      }
    };

    checkOrderStatus();

    return () => {
      cancelled = true;
    };
  }, [clearCart, isStripePayment, transactionId, braintreeOrderId]);

  const isError = confirmationStatus === "error";

  return (
    <>
      <SEO
        title="Payment Successful - Order Confirmed"
        description="Your payment was successful. Thank you for your order!"
      />
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                isError ? "bg-red-100" : "bg-green-100"
              }`}
            >
              <svg
                className={`w-12 h-12 ${
                  isError ? "text-red-600" : "text-green-600"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isError ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                )}
              </svg>
            </div>

            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              {isError ? "Order Confirmation Pending" : "Payment Successful!"}
            </h1>
            <p className={isError ? "text-red-600 mb-4" : "text-gray-600 mb-8"}>
              {isError
                ? errorMessage
                : confirmationStatus === "confirmed"
                  ? "Your payment was received and your order has been recorded."
                  : "Your payment was received. We are confirming your order now."}
            </p>

            {orderId && (
              <p className="text-sm text-gray-500 mb-6">
                Order ID: <strong>{orderId}</strong>
              </p>
            )}

            {orderSummary && (
              <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
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
                    <span>${orderSummary.subtotal} AUD</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Shipping</span>
                    <span>${orderSummary.shipping} AUD</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t">
                    <span>Total</span>
                    <span>${orderSummary.total} AUD</span>
                  </div>
                </div>

                {transactionId && (
                  <div className="mt-4 pt-4 border-t text-sm text-gray-500">
                    Transaction ID: {transactionId}
                  </div>
                )}
              </div>
            )}

            <div className="bg-blue-50 rounded-lg p-6 mb-8 text-left">
              <h3 className="font-semibold text-blue-800 mb-3">
                What happens next?
              </h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li className="flex items-start">
                  <span className="mr-2">1.</span>
                  <span>We will review and prepare your order.</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">2.</span>
                  <span>We will ship your items within 1-2 business days.</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">3.</span>
                  <span>You will receive tracking details when available.</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate("/shop")}
                className="px-6 py-3 bg-burgundy-600 text-white rounded-md hover:bg-burgundy-700 transition-colors font-semibold"
              >
                Continue Shopping
              </button>
              <button
                onClick={() => navigate("/")}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-semibold"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PaymentSuccess;
