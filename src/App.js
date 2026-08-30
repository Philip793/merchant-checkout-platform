import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";

import { HelmetProvider } from "react-helmet-async";

import { AuthProvider } from "./context/AuthContext.js";
import { ProductProvider } from "./context/ProductContext.js";
import { CartProvider } from "./context/CartContext.js";

import HomePage from "./components/HomePage.js";
import CheckoutPage from "./components/CheckoutPage.js";
import OrderSummary from "./components/OrderSummary.js";
import PaymentSuccess from "./components/PaymentSuccess.js";
import PaymentCancel from "./components/PaymentCancel.js";
import Navbar from "./components/Navbar.js";
import ShopPage from "./components/ShopPage.js";
import CartPage from "./components/CartPage.js";
import OurStoryPage from "./components/OurStoryPage.js";
import ContactPage from "./components/ContactPage.js";
import ShippingInfoPage from "./components/ShippingInfoPage.js";
import ReturnsPage from "./components/ReturnsPage.js";
import FAQPage from "./components/FAQPage.js";
import FeaturedPage from "./components/FeaturedPage.js";
import BlogPage from "./components/BlogPage.js";
import BlogPostPage from "./components/BlogPostPage.js";
import ProductPageFinal from "./components/ProductPageFinal.js";
import NotFoundPage from "./components/NotFoundPage.js";
import LoginPage from "./components/LoginPage.js";

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <ProductProvider>
          <CartProvider>
            <Router>
              <Navbar />

              <div className="mt-4">
                <Routes>
                  <Route
                    path="/"
                    element={<HomePage />}
                  />

                  <Route
                    path="/shop"
                    element={<ShopPage />}
                  />

                  <Route
                    path="/cart"
                    element={<CartPage />}
                  />

                  <Route
                    path="/order-summary"
                    element={<OrderSummary />}
                  />

                  <Route
                    path="/checkout"
                    element={<CheckoutPage />}
                  />

                  <Route
                    path="/checkout/success"
                    element={<PaymentSuccess />}
                  />

                  <Route
                    path="/checkout/cancel"
                    element={<PaymentCancel />}
                  />

                  <Route
                    path="/our-story"
                    element={<OurStoryPage />}
                  />

                  <Route
                    path="/contact"
                    element={<ContactPage />}
                  />

                  <Route
                    path="/shipping"
                    element={<ShippingInfoPage />}
                  />

                  <Route
                    path="/returns"
                    element={<ReturnsPage />}
                  />

                  <Route
                    path="/faq"
                    element={<FAQPage />}
                  />

                  <Route
                    path="/login"
                    element={<LoginPage />}
                  />

                  <Route
                    path="/featured"
                    element={<FeaturedPage />}
                  />

                  <Route
                    path="/blog"
                    element={<BlogPage />}
                  />

                  <Route
                    path="/blog/:postId"
                    element={<BlogPostPage />}
                  />

                  <Route
                    path="/product/:productId"
                    element={<ProductPageFinal />}
                  />

                  <Route
                    path="*"
                    element={<NotFoundPage />}
                  />
                </Routes>
              </div>
            </Router>
          </CartProvider>
        </ProductProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;