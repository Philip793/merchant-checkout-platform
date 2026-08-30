import React, {
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import SEO from "./SEO.js";

import {
  useProducts,
} from "../context/ProductContext.js";

const ShopPage = () => {
  const navigate = useNavigate();

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState("All");

  // --------------------------------------------------
  // Authoritative product catalogue
  //
  // Products now come from:
  //
  // React
  //   ↓
  // ProductContext
  //   ↓
  // GET /products
  //   ↓
  // server/data/productCatalog.js
  //
  // ShopPage no longer imports src/data/products.js.
  // --------------------------------------------------

  const {
    products,
    loading,
    error,
    refreshProducts,
  } = useProducts();

  // --------------------------------------------------
  // Categories
  //
  // Some products contain:
  //
  // category: "Flesh and Blood"
  //
  // while others contain:
  //
  // category: ["DnD", "TCG", "Board Game"]
  //
  // Flatten both formats into one category list.
  // --------------------------------------------------

  const categories = useMemo(
    () => [
      "All",

      ...new Set(
        products.flatMap(
          (product) => {
            if (
              Array.isArray(
                product.category,
              )
            ) {
              return product.category;
            }

            return product.category
              ? [product.category]
              : [];
          },
        ),
      ),
    ],
    [products],
  );

  // --------------------------------------------------
  // Filter products
  //
  // Previously this relied on getProductsByCategory()
  // from the duplicated frontend catalogue.
  //
  // Filtering is now performed directly against the
  // authoritative products supplied by ProductContext.
  // --------------------------------------------------

  const filteredProducts =
    useMemo(() => {
      if (
        selectedCategory === "All"
      ) {
        return products;
      }

      return products.filter(
        (product) => {
          if (
            Array.isArray(
              product.category,
            )
          ) {
            return product.category.includes(
              selectedCategory,
            );
          }

          return (
            product.category ===
            selectedCategory
          );
        },
      );
    }, [
      products,
      selectedCategory,
    ]);

  // --------------------------------------------------
  // Structured data
  // --------------------------------------------------

  const structuredData = useMemo(
    () => ({
      "@context":
        "https://schema.org",

      "@type":
        "CollectionPage",

      name:
        "Shop All Board Games - Magestic",

      description:
        "Browse our complete collection of premium board games including family games, strategy games, and party games.",

      url:
        "https://magestic.com.au/shop",

      mainEntity: {
        "@type": "ItemList",

        itemListElement:
          products.map(
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

              image:
                product.images
                  ?.thumbnail ||
                product.image,

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
    [products],
  );

  return (
    <>
      <SEO
        title="Shop All Board Games"
        description="Browse our complete collection of premium board games including family games, strategy games, and party games. Fast shipping across Australia."
        keywords="board games shop, buy board games online, family games, strategy games, party games, Australian board game store"
        url="/shop"
        structuredData={
          structuredData
        }
      />

      <main className="min-h-screen bg-gray-50 p-10">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-center">
            Shop All Board Games
          </h1>

          {/* Category Filter */}
          {!loading &&
            !error &&
            products.length > 0 && (
              <div className="flex justify-center mt-6">
                <div className="flex flex-wrap gap-2">
                  {categories.map(
                    (category) => (
                      <button
                        key={
                          category
                        }
                        type="button"
                        onClick={() =>
                          setSelectedCategory(
                            category,
                          )
                        }
                        className={`px-4 py-2 rounded-full font-medium transition-colors ${
                          selectedCategory ===
                          category
                            ? "bg-burgundy-600 text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {
                          category
                        }
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
        </header>

        {/* ----------------------------------------- */}
        {/* Loading state                             */}
        {/* ----------------------------------------- */}

        {loading && (
          <div className="flex justify-center items-center py-20">
            <p className="text-lg text-gray-600">
              Loading products...
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
        {/* Empty catalogue                           */}
        {/* ----------------------------------------- */}

        {!loading &&
          !error &&
          products.length === 0 && (
            <div className="text-center py-20">
              <p className="text-lg text-gray-600">
                No products are
                currently available.
              </p>
            </div>
          )}

        {/* ----------------------------------------- */}
        {/* Filter has no matching products           */}
        {/* ----------------------------------------- */}

        {!loading &&
          !error &&
          products.length > 0 &&
          filteredProducts.length ===
            0 && (
            <div className="text-center py-20">
              <p className="text-lg text-gray-600">
                No products found in
                this category.
              </p>
            </div>
          )}

        {/* ----------------------------------------- */}
        {/* Product grid                              */}
        {/* ----------------------------------------- */}

        {!loading &&
          !error &&
          filteredProducts.length >
            0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
              {filteredProducts.map(
                (product) => (
                  <div
                    key={
                      product.id
                    }
                    className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col justify-between cursor-pointer hover:shadow-xl transition-shadow"
                    onClick={() =>
                      navigate(
                        `/product/${product.id}`,
                      )
                    }
                  >
                    <div className="h-64 bg-gradient-to-br from-gold-100 to-gold-200 relative overflow-hidden group">
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
                        className="w-full h-full object-cover transform transition-transform duration-300 group-hover:scale-110"
                      />

                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300" />

                      {/* Out-of-stock badge */}
                      {product
                        .inventory &&
                        !product
                          .inventory
                          .inStock && (
                          <div className="absolute top-3 right-3 bg-gray-900 text-white px-3 py-1 rounded-full text-sm font-semibold">
                            Out of
                            Stock
                          </div>
                        )}
                    </div>

                    <div className="p-4 flex flex-col flex-grow">
                      <h2 className="text-lg font-semibold mb-2">
                        {
                          product.name
                        }
                      </h2>

                      <p className="text-gray-700 mb-4">
                        $
                        {Number(
                          product.price,
                        ).toFixed(
                          2,
                        )}
                      </p>

                      <button
                        type="button"
                        onClick={(
                          event,
                        ) => {
                          event.stopPropagation();

                          navigate(
                            `/product/${product.id}`,
                          );
                        }}
                        className="w-full px-4 py-2 bg-burgundy-600 text-white rounded-md hover:bg-burgundy-700 transition-colors font-semibold"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
      </main>
    </>
  );
};

export default ShopPage;