import React, {
  useMemo,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useProducts,
} from "../context/ProductContext.js";

const FeaturedProducts = () => {
  const navigate = useNavigate();

  // --------------------------------------------------
  // Authoritative product catalogue
  //
  // Products now come from the backend through
  // ProductContext.
  //
  // This component no longer imports:
  //
  // ../data/products.js
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
  // Replaces the old:
  //
  // getFeaturedProducts()
  //
  // with a filter against the authoritative catalogue.
  // --------------------------------------------------

  const featuredProducts =
    useMemo(() => {
      return products.filter(
        (product) =>
          product.featured === true,
      );
    }, [products]);

  // --------------------------------------------------
  // Navigation
  // --------------------------------------------------

  const handleViewProduct = (
    product,
  ) => {
    navigate(
      `/product/${product.id}`,
    );
  };

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ----------------------------------------- */}
        {/* Heading                                   */}
        {/* ----------------------------------------- */}

        <div className="flex justify-between items-center mb-12">
          <h2 className="text-4xl font-bold text-burgundy-500">
            Featured Products
          </h2>

          <button
            type="button"
            onClick={() =>
              navigate("/shop")
            }
            className="px-6 py-3 bg-burgundy-600 text-white rounded-md hover:bg-burgundy-700 transition-colors font-semibold"
          >
            SHOP ALL
          </button>
        </div>

        {/* ----------------------------------------- */}
        {/* Loading state                             */}
        {/* ----------------------------------------- */}

        {loading && (
          <div className="text-center py-12">
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
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Unable to load
              products
            </h3>

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
            <div className="text-center py-12">
              <p className="text-lg text-gray-600">
                No featured
                products are
                currently
                available.
              </p>
            </div>
          )}

        {/* ----------------------------------------- */}
        {/* Featured product cards                   */}
        {/* ----------------------------------------- */}

        {!loading &&
          !error &&
          featuredProducts.length >
            0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {featuredProducts.map(
                (product) => (
                  <div
                    key={
                      product.id
                    }
                    onClick={() =>
                      handleViewProduct(
                        product,
                      )
                    }
                    className="bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer transform transition-transform hover:scale-105"
                  >

                    {/* Product image */}
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

                      {/* Stock status */}
                      {!product
                        .inventory
                        ?.inStock && (
                        <div className="absolute top-3 right-3 bg-gray-900 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          Out of Stock
                        </div>
                      )}
                    </div>

                    {/* Product details */}
                    <div className="p-6 bg-gradient-to-br from-gold-100 to-gold-200">

                      <h3 className="text-xl font-semibold text-gray-800 mb-2">
                        {
                          product.name
                        }
                      </h3>

                      <p className="text-2xl font-bold text-burgundy-800 mb-4">
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

                          handleViewProduct(
                            product,
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
      </div>
    </section>
  );
};

export default FeaturedProducts;