import React, {
  useMemo,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useCart,
} from "../context/CartContext.js";

import {
  useProducts,
} from "../context/ProductContext.js";

import SEO from "./SEO.js";

const FeaturedPage = () => {
  const navigate = useNavigate();

  const {
    addToCart,
  } = useCart();

  // --------------------------------------------------
  // Authoritative product catalogue
  //
  // FeaturedPage no longer imports products from
  // src/data/products.js.
  //
  // All product information now comes from:
  //
  // server/data/productCatalog.js
  //        ↓
  // GET /products
  //        ↓
  // ProductContext
  //        ↓
  // FeaturedPage
  // --------------------------------------------------

  const {
    products,
    loading,
    error,
    refreshProducts,
  } = useProducts();

  // --------------------------------------------------
  // Featured products
  //
  // Previously:
  //
  // getFeaturedProducts()
  //
  // Now we simply filter the authoritative catalogue.
  // --------------------------------------------------

  const featuredProducts =
    useMemo(() => {
      return products.filter(
        (product) =>
          product.featured === true,
      );
    }, [products]);

  // --------------------------------------------------
  // Structured data
  // --------------------------------------------------

  const structuredData =
    useMemo(
      () => ({
        "@context":
          "https://schema.org",

        "@type":
          "CollectionPage",

        name:
          "Featured Products - Magestic",

        description:
          "Discover our handpicked selection of featured products.",

        url:
          "https://magestic.com.au/featured",

        mainEntity: {
          "@type":
            "ItemList",

          itemListElement:
            featuredProducts.map(
              (
                product,
                index,
              ) => ({
                "@type":
                  "Product",

                position:
                  index + 1,

                name:
                  product.name,

                description:
                  product.description,

                image:
                  product.images
                    ?.thumbnail ||
                  product.image,

                sku:
                  product.sku,

                offers: {
                  "@type":
                    "Offer",

                  price:
                    product.price,

                  priceCurrency:
                    "AUD",

                  availability:
                    product.inventory
                      ?.inStock
                      ? "https://schema.org/InStock"
                      : "https://schema.org/OutOfStock",
                },
              }),
            ),
        },
      }),
      [featuredProducts],
    );

  // --------------------------------------------------
  // Add to cart
  //
  // CartContext extracts only product.id and stores:
  //
  // {
  //   id,
  //   quantity
  // }
  //
  // Product price/name/SKU are never persisted as
  // authoritative browser cart data.
  // --------------------------------------------------

  const handleAddToCart = (
    product,
  ) => {
    if (
      !product.inventory
        ?.inStock
    ) {
      return;
    }

    addToCart(product);
  };

  return (
    <>
      <SEO
        title="Featured Products"
        description="Discover our handpicked selection of featured products."
        keywords="featured products, dice, tabletop accessories, gaming accessories, Flesh and Blood accessories"
        url="/featured"
        structuredData={
          structuredData
        }
      />

      <main className="min-h-screen bg-gray-50 py-16">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gold-600 font-semibold-4">
            Featured Products
          </h1>

          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Discover our
            handpicked selection
            of featured products.
          </p>
        </header>

        {/* ----------------------------------------- */}
        {/* Loading state                             */}
        {/* ----------------------------------------- */}

        {loading && (
          <div className="flex justify-center items-center py-20">
            <p className="text-lg text-gray-600">
              Loading featured
              products...
            </p>
          </div>
        )}

        {/* ----------------------------------------- */}
        {/* Error state                               */}
        {/* ----------------------------------------- */}

        {!loading && error && (
          <div className="max-w-lg mx-auto text-center bg-white rounded-lg shadow-md p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Unable to load
              products
            </h2>

            <p className="text-gray-600 mb-6">
              {error}
            </p>

            <button
              type="button"
              onClick={
                refreshProducts
              }
              className="px-6 py-2 bg-burgundy-600 text-white rounded-md hover:bg-burgundy-700 transition-colors font-semibold"
            >
              Try Again
            </button>
          </div>
        )}

        {/* ----------------------------------------- */}
        {/* No featured products                     */}
        {/* ----------------------------------------- */}

        {!loading &&
          !error &&
          featuredProducts.length ===
            0 && (
            <div className="text-center py-20">
              <p className="text-lg text-gray-600">
                No featured
                products are
                currently
                available.
              </p>
            </div>
          )}

        {/* ----------------------------------------- */}
        {/* Featured product grid                    */}
        {/* ----------------------------------------- */}

        {!loading &&
          !error &&
          featuredProducts.length >
            0 && (
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredProducts.map(
                (product) => (
                  <article
                    key={
                      product.id
                    }
                    className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                  >
                    <div className="h-96 bg-gradient-to-br from-gold-100 to-gold-200 relative overflow-hidden group">
                      <img
                        src={
                          product
                            .images
                            ?.thumbnail ||
                          product.image
                        }
                        alt={
                          product.name
                        }
                        className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-110"
                      />

                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300" />

                      {/* Out-of-stock badge */}
                      {!product
                        .inventory
                        ?.inStock && (
                        <div className="absolute top-3 right-3 bg-gray-900 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          Out of Stock
                        </div>
                      )}
                    </div>

                    <div className="p-6">
                      <h2 className="text-xl font-semibold text-gray-800 mb-2">
                        {
                          product.name
                        }
                      </h2>

                      <p className="text-gray-600 mb-4 text-sm line-clamp-3">
                        {String(
                          product.description ||
                            "",
                        )
                          .replace(
                            /\*\*/g,
                            "",
                          )
                          .slice(
                            0,
                            120,
                          )}
                        {String(
                          product.description ||
                            "",
                        ).length >
                        120
                          ? "..."
                          : ""}
                      </p>

                      <div className="flex justify-between items-center mb-4">
                        <span className="text-2xl font-bold text-gold-600">
                          $
                          {Number(
                            product.price,
                          ).toFixed(
                            2,
                          )}
                        </span>

                        <span className="bg-burgundy-500 text-burgundy-800 text-xs px-2 py-1 rounded-full">
                          Featured
                        </span>
                      </div>

                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleAddToCart(
                              product,
                            )
                          }
                          disabled={
                            !product
                              .inventory
                              ?.inStock
                          }
                          className={`flex-1 px-4 py-2 rounded-md transition-colors font-semibold ${
                            product
                              .inventory
                              ?.inStock
                              ? "bg-burgundy-600 text-white hover:bg-burgundy-700"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                          }`}
                        >
                          {product
                            .inventory
                            ?.inStock
                            ? "Add to Cart"
                            : "Out of Stock"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/product/${product.id}`,
                            )
                          }
                          className="flex-1 px-4 py-2 bg-gold-100 text-burgundy-700 rounded-md hover:bg-gold-200 transition-colors font-semibold"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </article>
                ),
              )}
            </section>
          )}

        <footer className="mt-12 text-center">
          <button
            type="button"
            onClick={() =>
              navigate(
                "/shop",
              )
            }
            className="px-8 py-3 bg-royal-purple-600 text-white rounded-md hover:bg-burgundy-700 transition-colors font-semibold text-lg"
          >
            View All Products
          </button>
        </footer>
      </main>
    </>
  );
};

export default FeaturedPage;