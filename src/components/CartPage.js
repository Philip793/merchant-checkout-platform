import React, { useState } from "react";
import { useCart } from "../context/CartContext.js";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, ArrowRight, Trash2 } from "lucide-react";

const CartPage = () => {
  const { cart, removeFromCart, cartCount } = useCart();
  const navigate = useNavigate();
  const [removingItem, setRemovingItem] = useState(null);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleRemove = async (itemId) => {
    setRemovingItem(itemId);
    // Small delay for visual feedback
    await new Promise((resolve) => setTimeout(resolve, 200));
    removeFromCart(itemId);
    setRemovingItem(null);
  };

  const handleKeyDown = (e, action) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };

  if (cartCount === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-semibold mb-3 text-gray-800">
            Your cart is empty
          </h2>
          <p className="text-gray-500 mb-6">
            Looks like you haven't added anything to your cart yet. Explore our
            collection and find something you'll love!
          </p>
          <button
            onClick={() => navigate("/shop")}
            onKeyDown={(e) => handleKeyDown(e, () => navigate("/shop"))}
            className="inline-flex items-center px-6 py-3 bg-burgundy-600 text-white rounded-lg hover:bg-burgundy-700 focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:ring-offset-2 transition-colors font-medium"
            tabIndex={0}
            aria-label="Continue shopping"
          >
            Continue Shopping
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">
          Your Cart ({cartCount} {cartCount === 1 ? "item" : "items"})
        </h1>

        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {/* Cart Items */}
          <div className="divide-y divide-gray-100">
            {cart.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-4 sm:p-6 transition-opacity ${
                  removingItem === item.id ? "opacity-50" : "opacity-100"
                }`}
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className="relative">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-20 h-20 object-cover rounded-lg"
                      loading="lazy"
                    />
                    {item.quantity > 1 && (
                      <span className="absolute -top-2 -right-2 bg-burgundy-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-medium">
                        {item.quantity}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-gray-800 truncate">
                      {item.name}
                    </h3>
                    <p className="text-gray-600 mt-1">
                      ${item.price.toFixed(2)}
                      {item.quantity > 1 && (
                        <span className="text-gray-400 text-sm ml-2">
                          x {item.quantity}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 ml-4">
                  <p className="text-lg font-semibold text-gray-800 hidden sm:block">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                  <button
                    onClick={() => handleRemove(item.id)}
                    onKeyDown={(e) =>
                      handleKeyDown(e, () => handleRemove(item.id))
                    }
                    disabled={removingItem === item.id}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                    tabIndex={0}
                    aria-label={`Remove ${item.name} from cart`}
                    title="Remove item"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="bg-gray-50 p-4 sm:p-6 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-xl font-semibold text-gray-800">Items subtotal</span>
              <span className="text-2xl font-bold text-burgundy-600">
                ${total.toFixed(2)} AUD
              </span>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Shipping is calculated after you enter your delivery address at checkout.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="p-4 sm:p-6 space-y-3">
            <button
              onClick={() => navigate("/order-summary")}
              onKeyDown={(e) =>
                handleKeyDown(e, () => navigate("/order-summary"))
              }
              className="w-full bg-burgundy-600 text-white py-4 rounded-lg hover:bg-burgundy-700 focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:ring-offset-2 transition-colors font-semibold text-lg"
              tabIndex={0}
              aria-label="Proceed to checkout"
            >
              Proceed to Checkout
            </button>
            <button
              onClick={() => navigate("/shop")}
              onKeyDown={(e) => handleKeyDown(e, () => navigate("/shop"))}
              className="w-full bg-white text-burgundy-600 border-2 border-burgundy-600 py-3 rounded-lg hover:bg-burgundy-50 focus:outline-none focus:ring-2 focus:ring-burgundy-500 focus:ring-offset-2 transition-colors font-medium"
              tabIndex={0}
              aria-label="Continue shopping"
            >
              Continue Shopping
            </button>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-8 grid grid-cols-2 gap-4 text-center">
          <div className="flex flex-col items-center">
            <svg
              className="w-8 h-8 text-burgundy-600 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span className="text-sm text-gray-600">Secure Checkout</span>
          </div>
          <div className="flex flex-col items-center">
            <svg
              className="w-8 h-8 text-burgundy-600 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span className="text-sm text-gray-600">Easy Returns</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
