import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

// Use the same backend URL convention as AuthContext.
const API_URL =
  process.env.REACT_APP_API_URL ||
  "http://localhost:4242";

// ----------------------------------------------------
// Product Context
// ----------------------------------------------------

const ProductContext = createContext();

// ----------------------------------------------------
// useProducts
//
// Custom hook used by components that need access to:
// - product catalogue
// - loading state
// - errors
// - product lookup
// - catalogue refresh
// ----------------------------------------------------

export const useProducts = () => {
  const context = useContext(ProductContext);

  if (!context) {
    throw new Error(
      "useProducts must be used within a ProductProvider",
    );
  }

  return context;
};

// ----------------------------------------------------
// ProductProvider
//
// Retrieves the authoritative product catalogue from
// the backend.
//
// IMPORTANT:
//
// The frontend no longer owns product:
// - prices
// - names
// - SKUs
// - descriptions
// - inventory
//
// Those values now come from the backend GET /products
// endpoint.
// ----------------------------------------------------

export const ProductProvider = ({
  children,
}) => {
  const [products, setProducts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  // --------------------------------------------------
  // fetchProducts
  //
  // Retrieves the complete product catalogue from
  // the backend.
  //
  // Can also be called manually if we need to refresh
  // stock after a checkout or other inventory change.
  // --------------------------------------------------

  const fetchProducts = useCallback(
    async (signal) => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${API_URL}/products`,
          {
            method: "GET",

            headers: {
              Accept: "application/json",
            },

            signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            `Failed to load products (${response.status})`,
          );
        }

        const data =
          await response.json();

        if (
          !data ||
          !Array.isArray(data.products)
        ) {
          throw new Error(
            "Invalid product data received from server",
          );
        }

        setProducts(data.products);
      } catch (err) {
        // AbortController intentionally throws when
        // the component unmounts.
        // That is not a real application error.
        if (
          err.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Failed to load products:",
          err,
        );

        setError(
          "Unable to load products. Please try again.",
        );
      } finally {
        if (
          !signal ||
          !signal.aborted
        ) {
          setLoading(false);
        }
      }
    },
    [],
  );

  // --------------------------------------------------
  // Initial catalogue load
  // --------------------------------------------------

  useEffect(() => {
    const controller =
      new AbortController();

    fetchProducts(
      controller.signal,
    );

    return () => {
      controller.abort();
    };
  }, [fetchProducts]);

  // --------------------------------------------------
  // getProductById
  //
  // Performs a local lookup against products already
  // retrieved from the authoritative backend catalogue.
  //
  // React Router supplies route params as strings,
  // therefore both IDs are converted to numbers.
  // --------------------------------------------------

  const getProductById = (
    productId,
  ) => {
    const id =
      Number.parseInt(
        productId,
        10,
      );

    if (!Number.isInteger(id)) {
      return null;
    }

    return (
      products.find(
        (product) =>
          Number(product.id) === id,
      ) || null
    );
  };

  // --------------------------------------------------
  // refreshProducts
  //
  // Allows another component to refresh the catalogue,
  // particularly useful after inventory changes.
  // --------------------------------------------------

  const refreshProducts =
    async () => {
      await fetchProducts();
    };

  // --------------------------------------------------
  // Context value
  // --------------------------------------------------

  const value = {
    products,
    loading,
    error,
    getProductById,
    refreshProducts,
  };

  return (
    <ProductContext.Provider
      value={value}
    >
      {children}
    </ProductContext.Provider>
  );
};

export default ProductContext;