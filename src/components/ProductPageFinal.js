import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
  useNavigate,
} from "react-router-dom";

import {
  useCart,
} from "../context/CartContext.js";

import {
  useProducts,
} from "../context/ProductContext.js";

import SEO from "./SEO.js";

const ProductPageFinal = () => {
  const { productId } = useParams();
  const navigate = useNavigate();

  const {
    addToCart,
  } = useCart();

  // --------------------------------------------------
  // Authoritative product catalogue
  //
  // Product data now comes from:
  //
  // server/data/productCatalog.js
  //        ↓
  // GET /products
  //        ↓
  // ProductContext
  //        ↓
  // ProductPageFinal
  //
  // This component no longer imports
  // src/data/products.js.
  // --------------------------------------------------

  const {
    products,
    loading,
    error,
    getProductById,
    refreshProducts,
  } = useProducts();

  // --------------------------------------------------
  // UI state
  // --------------------------------------------------

  const [
    zoomPosition,
    setZoomPosition,
  ] = useState({
    x: 0,
    y: 0,
  });

  const [
    isHovering,
    setIsHovering,
  ] = useState(false);

  const [
    hoveredImage,
    setHoveredImage,
  ] = useState(null);

  const [
    selectedImage,
    setSelectedImage,
  ] = useState(null);

  const [
    quantity,
    setQuantity,
  ] = useState(1);

  const [
    showCartPopup,
    setShowCartPopup,
  ] = useState(false);

  // --------------------------------------------------
  // Find current product from authoritative catalogue
  // --------------------------------------------------

  const product =
    getProductById(productId);

  // --------------------------------------------------
  // Reset product-specific UI when navigating directly
  // from one product page to another.
  // --------------------------------------------------

  useEffect(() => {
    setSelectedImage(null);
    setHoveredImage(null);
    setIsHovering(false);
    setQuantity(1);
    setShowCartPopup(false);
  }, [productId]);

  // --------------------------------------------------
  // Image zoom
  // --------------------------------------------------

  const handleMouseMove = (
    event,
  ) => {
    const rect =
      event.currentTarget.getBoundingClientRect();

    const x =
      ((event.clientX -
        rect.left) /
        rect.width) *
      100;

    const y =
      ((event.clientY -
        rect.top) /
        rect.height) *
      100;

    setZoomPosition({
      x,
      y,
    });

    // Clear gallery hover image when hovering
    // directly over the main product image.
    setHoveredImage(null);
  };

  // --------------------------------------------------
  // Related products
  //
  // Previously supplied by getRelatedProducts()
  // from src/data/products.js.
  //
  // We now derive related products from the
  // authoritative server-backed catalogue.
  // --------------------------------------------------

  const relatedProducts =
    useMemo(() => {
      if (!product) {
        return [];
      }

      const currentCategories =
        Array.isArray(
          product.category,
        )
          ? product.category
          : [product.category];

      return products
        .filter(
          (candidate) => {
            // Never show the current product
            // as its own related product.
            if (
              Number(candidate.id) ===
              Number(product.id)
            ) {
              return false;
            }

            const candidateCategories =
              Array.isArray(
                candidate.category,
              )
                ? candidate.category
                : [
                    candidate.category,
                  ];

            return candidateCategories.some(
              (category) =>
                currentCategories.includes(
                  category,
                ),
            );
          },
        )
        .slice(0, 3);
    }, [
      products,
      product,
    ]);

  // --------------------------------------------------
  // Add to cart
  //
  // CartContext now persists only:
  //
  // {
  //   id,
  //   quantity
  // }
  //
  // The product price/name/SKU are rehydrated from
  // ProductContext rather than trusted from storage.
  // --------------------------------------------------

  const handleAddToCart = () => {
    if (
      !product ||
      !product.inventory?.inStock
    ) {
      return;
    }

    for (
      let i = 0;
      i < quantity;
      i += 1
    ) {
      addToCart(product);
    }

    setShowCartPopup(true);
  };

  // --------------------------------------------------
  // Loading state
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gold-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-burgundy-600 mx-auto mb-4" />

          <p className="text-gray-600">
            Loading product
            details...
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // API error state
  //
  // Keep this separate from "Product Not Found".
  // A temporary backend failure should not make the
  // customer think the product has been deleted.
  // --------------------------------------------------

  if (error) {
    return (
      <div className="min-h-screen bg-gold-50 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Unable to Load
            Product
          </h1>

          <p className="text-gray-600 mb-8">
            {error}
          </p>

          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={
                refreshProducts
              }
              className="px-6 py-2 bg-burgundy-600 text-white rounded-md hover:bg-burgundy-700 transition-colors font-semibold"
            >
              Try Again
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/shop",
                )
              }
              className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Back to Shop
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // Product does not exist in authoritative catalogue
  // --------------------------------------------------

  if (!product) {
    return (
      <div className="min-h-screen bg-gold-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Product Not Found
          </h1>

          <p className="text-gray-600 mb-8">
            The product you're
            looking for doesn't
            exist.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/shop",
              )
            }
            className="px-6 py-2 bg-burgundy-600 text-white rounded-md hover:bg-burgundy-700 transition-colors font-semibold"
          >
            Back to Shop
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // Structured data
  // --------------------------------------------------

  const structuredData = {
    "@context":
      "https://schema.org",

    "@type":
      "Product",

    name:
      product.name ||
      "Product",

    image:
      product.images?.main ||
      product.image ||
      "",

    description:
      product.description ||
      "",

    sku:
      product.sku,

    brand: {
      "@type":
        "Brand",

      name:
        "Magestic",
    },

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

    ...(product.ratings && {
      aggregateRating: {
        "@type":
          "AggregateRating",

        ratingValue:
          product.ratings
            ?.average ||
          0,

        reviewCount:
          product.ratings
            ?.reviews ||
          0,
      },
    }),
  };

  return (
    <>
      <SEO
        title={`${product.name} - Magestic`}
        description={
          product.description
        }
        keywords={`${product.name}, dice, tabletop gaming, TCG accessories, gaming accessories`}
        url={`/product/${productId}`}
        structuredData={
          structuredData
        }
      />

      <main className="min-h-screen bg-gold-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* --------------------------------------- */}
          {/* Breadcrumb                              */}
          {/* --------------------------------------- */}

          <nav className="mb-8">
            <ol className="flex items-center space-x-2 text-sm text-gray-600">
              <li>
                <button
                  type="button"
                  onClick={() =>
                    navigate("/")
                  }
                  className="hover:text-burgundy-600"
                >
                  Home
                </button>
              </li>

              <li>/</li>

              <li>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/shop",
                    )
                  }
                  className="hover:text-burgundy-600"
                >
                  Shop
                </button>
              </li>

              <li>/</li>

              <li className="text-burgundy-600 font-semibold">
                {
                  product.name
                }
              </li>
            </ol>
          </nav>

          {/* --------------------------------------- */}
          {/* Product title                           */}
          {/* --------------------------------------- */}

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {
                product.name
              }
            </h1>

            <p className="text-2xl font-bold text-burgundy-600 mb-4">
              $
              {Number(
                product.price,
              ).toFixed(2)}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

            {/* ------------------------------------- */}
            {/* Product images                        */}
            {/* ------------------------------------- */}

            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">

                {/* Main image */}
                <div className="aspect-square bg-gradient-to-br from-gold-100 to-gold-200">
                  <div
                    className="relative overflow-hidden cursor-crosshair w-full h-full"
                    onMouseMove={
                      handleMouseMove
                    }
                    onMouseEnter={() =>
                      setIsHovering(
                        true,
                      )
                    }
                    onMouseLeave={() =>
                      setIsHovering(
                        false,
                      )
                    }
                  >
                    <img
                      src={
                        selectedImage ||
                        product.images
                          ?.main ||
                        product.image ||
                        "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop"
                      }
                      alt={
                        product.name
                      }
                      className="w-full h-full object-contain main-product-image"
                      onError={(
                        event,
                      ) => {
                        event.currentTarget.src =
                          "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop";
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Gallery images */}
              {product.images
                ?.gallery &&
                product.images.gallery
                  .length >
                  0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {product.images.gallery.map(
                      (
                        galleryImage,
                        index,
                      ) => (
                        <div
                          key={
                            galleryImage ||
                            index
                          }
                          className="aspect-square bg-white rounded-lg overflow-hidden shadow-md group relative cursor-pointer"
                          onMouseEnter={() =>
                            setHoveredImage(
                              galleryImage,
                            )
                          }
                          onMouseLeave={() =>
                            setHoveredImage(
                              null,
                            )
                          }
                        >
                          <img
                            src={
                              galleryImage
                            }
                            alt={`${product.name} - Gallery ${index + 1}`}
                            className="w-full h-full object-contain transition-transform duration-300 ease-in-out group-hover:scale-110"
                            onClick={() =>
                              setSelectedImage(
                                galleryImage,
                              )
                            }
                            onError={(
                              event,
                            ) => {
                              event.currentTarget.src =
                                "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&h=300&fit=crop";
                            }}
                          />
                        </div>
                      ),
                    )}
                  </div>
                )}
            </div>

            {/* ------------------------------------- */}
            {/* 200% zoom                             */}
            {/* ------------------------------------- */}

            {(isHovering ||
              hoveredImage) && (
              <div className="aspect-square bg-white rounded-lg shadow-xl overflow-hidden border border-gray-200 hidden lg:block pointer-events-none">
                <img
                  src={
                    hoveredImage ||
                    selectedImage ||
                    product.images
                      ?.main ||
                    product.image ||
                    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop"
                  }
                  alt={`${product.name} - Zoom`}
                  className="w-full h-full object-contain"
                  style={{
                    transform:
                      "scale(2)",

                    transformOrigin:
                      `${zoomPosition.x}% ${zoomPosition.y}%`,
                  }}
                  onError={(
                    event,
                  ) => {
                    event.currentTarget.src =
                      "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop";
                  }}
                />
              </div>
            )}

            {/* ------------------------------------- */}
            {/* Product details                       */}
            {/* ------------------------------------- */}

            <div className="space-y-6">
              <div>
                <p className="text-gray-700 leading-relaxed mb-6 whitespace-pre-line">
                  {
                    product.description
                  }
                </p>
              </div>

              {/* Product features */}
              {Array.isArray(
                product.features,
              ) &&
                product.features
                  .length >
                  0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-3">
                      Features
                    </h2>

                    <ul className="space-y-2">
                      {product.features.map(
                        (
                          feature,
                          index,
                        ) => (
                          <li
                            key={`${product.id}-feature-${index}`}
                            className="flex items-start"
                          >
                            <span className="text-burgundy-600 mr-2">
                              •
                            </span>

                            <span className="text-gray-700">
                              {
                                feature
                              }
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

              {/* Product info */}
              <div className="grid grid-cols-2 gap-4">

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">
                    Category
                  </p>

                  <p className="font-semibold text-gray-900">
                    {Array.isArray(
                      product.category,
                    )
                      ? product.category.join(
                          ", ",
                        )
                      : product.category}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">
                    Availability
                  </p>

                  <p
                    className={`font-semibold ${
                      product
                        .inventory
                        ?.inStock
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {product
                      .inventory
                      ?.inStock
                      ? "In Stock"
                      : "Out of Stock"}
                  </p>
                </div>
              </div>

              {/* ----------------------------------- */}
              {/* Quantity / Add to cart              */}
              {/* ----------------------------------- */}

              <div className="space-y-4">

                <div className="flex items-center space-x-4">
                  <label
                    htmlFor="product-quantity"
                    className="text-sm font-medium text-gray-700"
                  >
                    Quantity:
                  </label>

                  <select
                    id="product-quantity"
                    value={
                      quantity
                    }
                    onChange={(
                      event,
                    ) =>
                      setQuantity(
                        Number.parseInt(
                          event
                            .target
                            .value,
                          10,
                        ),
                      )
                    }
                    disabled={
                      !product
                        .inventory
                        ?.inStock
                    }
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-burgundy-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    {[
                      1, 2, 3, 4, 5,
                    ].map(
                      (num) => (
                        <option
                          key={
                            num
                          }
                          value={
                            num
                          }
                        >
                          {
                            num
                          }
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={
                    handleAddToCart
                  }
                  disabled={
                    !product
                      .inventory
                      ?.inStock
                  }
                  className="w-full px-6 py-3 bg-burgundy-600 text-white rounded-md hover:bg-burgundy-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
                >
                  {product
                    .inventory
                    ?.inStock
                    ? "Add to Cart"
                    : "Out of Stock"}
                </button>
              </div>
            </div>
          </div>

          {/* --------------------------------------- */}
          {/* Related products                        */}
          {/* --------------------------------------- */}

          {relatedProducts.length >
            0 && (
            <section className="mt-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">
                Related Products
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {relatedProducts.map(
                  (
                    relatedProduct,
                  ) => (
                    <article
                      key={
                        relatedProduct.id
                      }
                      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                    >
                      <div className="h-48 bg-gradient-to-br from-gold-100 to-gold-200 relative">
                        <img
                          src={
                            relatedProduct
                              .images
                              ?.thumbnail ||
                            relatedProduct.image
                          }
                          alt={
                            relatedProduct.name
                          }
                          className="w-full h-full object-cover"
                        />

                        {!relatedProduct
                          .inventory
                          ?.inStock && (
                          <div className="absolute top-3 right-3 bg-gray-900 text-white px-3 py-1 rounded-full text-xs font-semibold">
                            Out of
                            Stock
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                          {
                            relatedProduct.name
                          }
                        </h3>

                        <p className="text-xl font-bold text-burgundy-600 mb-3">
                          $
                          {Number(
                            relatedProduct.price,
                          ).toFixed(
                            2,
                          )}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/product/${relatedProduct.id}`,
                            )
                          }
                          className="w-full px-4 py-2 bg-burgundy-600 text-white rounded-md hover:bg-burgundy-700 transition-colors font-semibold"
                        >
                          View Details
                        </button>
                      </div>
                    </article>
                  ),
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* ------------------------------------------- */}
      {/* Add-to-cart popup                           */}
      {/* ------------------------------------------- */}

      {showCartPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md mx-4 shadow-2xl">

            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Added to Cart!
                </h3>

                <p className="text-gray-600">
                  {quantity} ×{" "}
                  {product.name}
                </p>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() =>
                  setShowCartPopup(
                    false,
                  )
                }
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Continue Shopping
              </button>

              <button
                type="button"
                onClick={() => {
                  navigate(
                    "/cart",
                  );

                  setShowCartPopup(
                    false,
                  );
                }}
                className="flex-1 px-4 py-2 bg-burgundy-600 text-white rounded-md hover:bg-burgundy-700 transition-colors font-semibold"
              >
                View Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductPageFinal;