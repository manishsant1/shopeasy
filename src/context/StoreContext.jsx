import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { load, save } from '../api/storage';

const StoreContext = createContext(null);

// Cart lines are stored as { product, qty } so the cart page renders without a lookup.
export function StoreProvider({ children }) {
  const [cart, setCart] = useState(() => load('cart', []));
  const [wishlist, setWishlist] = useState(() => load('wishlist', []));

  useEffect(() => save('cart', cart), [cart]);
  useEffect(() => save('wishlist', wishlist), [wishlist]);

  const value = useMemo(() => {
    const addToCart = (product, qty = 1) =>
      setCart((lines) => {
        const existing = lines.find((l) => l.product.id === product.id);
        if (existing) {
          return lines.map((l) =>
            l.product.id === product.id
              ? { ...l, qty: Math.min(l.qty + qty, product.stock) }
              : l,
          );
        }
        return [...lines, { product, qty: Math.min(qty, product.stock) }];
      });

    const updateQty = (id, qty) =>
      setCart((lines) =>
        qty <= 0
          ? lines.filter((l) => l.product.id !== id)
          : lines.map((l) =>
              l.product.id === id ? { ...l, qty: Math.min(qty, l.product.stock) } : l,
            ),
      );

    const removeFromCart = (id) => setCart((lines) => lines.filter((l) => l.product.id !== id));
    const clearCart = () => setCart([]);

    const toggleWishlist = (product) =>
      setWishlist((items) =>
        items.some((p) => p.id === product.id)
          ? items.filter((p) => p.id !== product.id)
          : [...items, product],
      );
    const isWishlisted = (id) => wishlist.some((p) => p.id === id);

    const cartCount = cart.reduce((n, l) => n + l.qty, 0);
    const subtotal = cart.reduce((sum, l) => sum + l.qty * l.product.price, 0);

    return {
      cart, wishlist, cartCount, subtotal,
      addToCart, updateQty, removeFromCart, clearCart, toggleWishlist, isWishlisted,
    };
  }, [cart, wishlist]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

export const formatPrice = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export { orderTotals, SHIPPING_THRESHOLD } from '../../shared/pricing';
