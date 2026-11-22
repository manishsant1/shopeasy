// Used by both the browser (to show totals) and the server (to charge them),
// so the two always agree.
export const SHIPPING_THRESHOLD = 50;
export const SHIPPING_FEE = 5.99;
export const TAX_RATE = 0.08;

const round2 = (n) => Math.round(n * 100) / 100;

export function orderTotals(subtotal) {
  const shipping = subtotal === 0 || subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const tax = subtotal * TAX_RATE;
  return {
    subtotal: round2(subtotal),
    shipping,
    tax: round2(tax),
    total: round2(subtotal + shipping + tax),
  };
}
