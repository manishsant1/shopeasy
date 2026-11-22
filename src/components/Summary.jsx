import { formatPrice } from '../context/StoreContext';

export default function Summary({ totals }) {
  return (
    <dl className="summary">
      <dt>Subtotal</dt><dd>{formatPrice(totals.subtotal)}</dd>
      <dt>Shipping</dt><dd>{totals.shipping === 0 ? 'Free' : formatPrice(totals.shipping)}</dd>
      <dt>Tax (8%)</dt><dd>{formatPrice(totals.tax)}</dd>
      <dt className="total">Total</dt><dd className="total">{formatPrice(totals.total)}</dd>
    </dl>
  );
}
