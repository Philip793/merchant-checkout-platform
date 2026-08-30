import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useProducts } from "./ProductContext.js";

// ----------------------------------------------------
// Cart Context
// ----------------------------------------------------

const CartContext = createContext();

// ----------------------------------------------------
// loadSavedCart
//
// Cart data stored in the browser must NOT be treated
// as authoritative product information.
//
// We only persist:
//
// {
//   id: 1,
//   quantity: 2
// }
//
// We deliberately do NOT persist:
//
// - price
// - name
// - SKU
// - description
// - inventory
//
// Those values are rehydrated from the server-backed
// ProductContext every time the application loads.
// ----------------------------------------------------

const loadSavedCart = () => {
  try {
    const savedCart =
      localStorage.getItem("cart");

    if (!savedCart) {
      return [];
    }

    const parsedCart =
      JSON.parse(savedCart);

    if (!Array.isArray(parsedCart)) {
      return [];
    }

    // This also automatically migrates old carts.
    //
    // Previously localStorage contained the entire
    // product object. We now deliberately extract
    // only id + quantity from those old records.
    return parsedCart
      .map((item) => {
        const id = Number.parseInt(
          item?.id,
          10,
        );

        const quantity =
          Math.max(
            1,
            Number.parseInt(
              item?.quantity,
              10,
            ) || 1,
          );

        return {
          id,
          quantity,
        };
      })
      .filter((item) =>
        Number.isInteger(item.id),
      );
  } catch (error) {
    console.error(
      "Failed to load cart:",
      error,
    );

    return [];
  }
};

// ----------------------------------------------------
// CartProvider
// ----------------------------------------------------

export const CartProvider = ({
  children,
}) => {
  // --------------------------------------------------
  // cartItems
  //
  // This is the actual browser-persisted cart.
  //
  // Example:
  //
  // [
  //   {
  //     id: 1,
  //     quantity: 2
  //   }
  // ]
  //
  // It intentionally contains NO price information.
  // --------------------------------------------------

  const [
    cartItems,
    setCartItems,
  ] = useState(loadSavedCart);

  // Product information comes from the authoritative
  // backend catalogue through ProductContext.
  const {
    products,
    loading: productsLoading,
    error: productsError,
  } = useProducts();

  // --------------------------------------------------
  // Persist cart IDs + quantities only
  // --------------------------------------------------

  useEffect(() => {
    try {
      localStorage.setItem(
        "cart",
        JSON.stringify(cartItems),
      );
    } catch (error) {
      console.error(
        "Failed to save cart:",
        error,
      );
    }
  }, [cartItems]);

  // --------------------------------------------------
  // productById
  //
  // Create an efficient lookup table from the current
  // server-backed product catalogue.
  // --------------------------------------------------

  const productById =
    useMemo(() => {
      return new Map(
        products.map(
          (product) => [
            Number(product.id),
            product,
          ],
        ),
      );
    }, [products]);

  // --------------------------------------------------
  // Hydrate cart
  //
  // Convert:
  //
  // {
  //   id: 1,
  //   quantity: 2
  // }
  //
  // into:
  //
  // {
  //   id: 1,
  //   name: "...",
  //   price: 24.99,
  //   sku: "...",
  //   images: {...},
  //   quantity: 2
  // }
  //
  // All product data comes from the latest catalogue
  // received from the backend.
  // --------------------------------------------------

  const cart =
    useMemo(() => {
      return cartItems
        .map((cartItem) => {
          const product =
            productById.get(
              cartItem.id,
            );

          // Product may have been removed from
          // the catalogue since the cart was saved.
          if (!product) {
            return null;
          }

          return {
            ...product,
            quantity:
              cartItem.quantity,
          };
        })
        .filter(Boolean);
    }, [
      cartItems,
      productById,
    ]);

  // --------------------------------------------------
  // Remove products that no longer exist
  //
  // Only do this AFTER a successful catalogue load.
  //
  // We must not delete someone's cart simply because
  // the API temporarily failed.
  // --------------------------------------------------

  useEffect(() => {
    if (
      productsLoading ||
      productsError
    ) {
      return;
    }

    setCartItems(
      (currentItems) => {
        const validItems =
          currentItems.filter(
            (item) =>
              productById.has(
                item.id,
              ),
          );

        // Avoid unnecessary state updates.
        if (
          validItems.length ===
          currentItems.length
        ) {
          return currentItems;
        }

        return validItems;
      },
    );
  }, [
    productsLoading,
    productsError,
    productById,
  ]);

  // --------------------------------------------------
  // addToCart
  //
  // A component may pass a whole product object because
  // that is convenient for the UI.
  //
  // However, we deliberately extract ONLY its ID before
  // updating cart state.
  // --------------------------------------------------

  const addToCart = (
    product,
  ) => {
    const productId =
      Number.parseInt(
        product?.id,
        10,
      );

    if (
      !Number.isInteger(
        productId,
      )
    ) {
      console.error(
        "Cannot add invalid product to cart:",
        product,
      );

      return;
    }

    // Do not allow arbitrary IDs to be added.
    //
    // The product must exist in the catalogue that
    // came from our backend.
    if (
      !productById.has(
        productId,
      )
    ) {
      console.error(
        "Cannot add unknown product to cart:",
        productId,
      );

      return;
    }

    setCartItems(
      (previousCart) => {
        const existingItem =
          previousCart.find(
            (item) =>
              item.id ===
              productId,
          );

        // Product already exists:
        // increment quantity.
        if (existingItem) {
          return previousCart.map(
            (item) =>
              item.id ===
              productId
                ? {
                    ...item,

                    quantity:
                      item.quantity +
                      1,
                  }
                : item,
          );
        }

        // New cart entry contains only:
        //
        // ID + quantity
        return [
          ...previousCart,

          {
            id: productId,
            quantity: 1,
          },
        ];
      },
    );
  };

  // --------------------------------------------------
  // removeFromCart
  // --------------------------------------------------

  const removeFromCart = (
    id,
  ) => {
    const productId =
      Number.parseInt(
        id,
        10,
      );

    if (
      !Number.isInteger(
        productId,
      )
    ) {
      return;
    }

    setCartItems(
      (previousCart) =>
        previousCart.filter(
          (item) =>
            item.id !==
            productId,
        ),
    );
  };

  // --------------------------------------------------
  // clearCart
  // --------------------------------------------------

  const clearCart = () => {
    try {
      localStorage.removeItem(
        "cart",
      );
    } catch (error) {
      console.error(
        "Failed to clear saved cart:",
        error,
      );
    }

    setCartItems([]);
  };

  // --------------------------------------------------
  // cartCount
  //
  // Count quantities from cartItems rather than the
  // hydrated cart.
  //
  // This means the navbar can still know that there
  // are saved items while the product catalogue is
  // initially loading.
  // --------------------------------------------------

  const cartCount =
    cartItems.reduce(
      (total, item) =>
        total +
        item.quantity,
      0,
    );

  // --------------------------------------------------
  // Context value
  // --------------------------------------------------

  const value = {
    cart,
    cartCount,

    addToCart,
    removeFromCart,
    clearCart,

    // These are available for components that need to
    // avoid rendering cart values before authoritative
    // catalogue data has loaded.
    cartLoading:
      productsLoading,

    cartError:
      productsError,
  };

  return (
    <CartContext.Provider
      value={value}
    >
      {children}
    </CartContext.Provider>
  );
};

// ----------------------------------------------------
// useCart
// ----------------------------------------------------

export const useCart = () => {
  const context =
    useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used within a CartProvider",
    );
  }

  return context;
};

export default CartContext;