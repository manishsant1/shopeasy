import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { placeOrder } from '../api/api';
import { load, save } from '../api/storage';
import { formatPrice, orderTotals, useStore } from '../context/StoreContext';
import { PAYMENT_METHODS, SHIPPING_FIELDS, validateShipping } from '../../shared/validation';
import Summary from '../components/Summary';

export default function Checkout() {
  const { cart, subtotal, clearCart } = useStore();
  const navigate = useNavigate();
  // Remember the last shipping address to make repeat checkouts faster.
  const [form, setForm] = useState(() => load('shipping', {}));
  const [payment, setPayment] = useState('card');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (cart.length === 0 && !submitting) return <Navigate to="/cart" replace />;

  // Shown as an estimate; the server recalculates the total from its own prices.
  const totals = orderTotals(subtotal);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    const errs = validateShipping(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    save('shipping', form);
    try {
      const order = await placeOrder({
        items: cart.map(({ product, qty }) => ({ id: product.id, qty })),
        shipping: form,
        payment,
      });
      clearCart();
      navigate('/orders', { state: { justPlaced: order.id } });
    } catch (err) {
      setErrors(err.details ?? {});
      setSubmitError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1>Checkout</h1>
      <form className="two-col" onSubmit={handleSubmit} noValidate>
        <div className="panel">
          <h3>Shipping details</h3>
          <div className="form-grid">
            {SHIPPING_FIELDS.map((f) => (
              <label key={f.name} className={errors[f.name] ? 'invalid' : ''}>
                {f.label}
                <input
                  type={f.type ?? 'text'}
                  autoComplete={f.autoComplete}
                  value={form[f.name] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />
                {errors[f.name] && <span className="error">{errors[f.name]}</span>}
              </label>
            ))}
          </div>
          <h3>Payment</h3>
          <p className="muted small">This is a demo. No real payment is taken.</p>
          {PAYMENT_METHODS.map(([value, label]) => (
            <label key={value} className="check">
              <input type="radio" name="payment" value={value} checked={payment === value} onChange={() => setPayment(value)} />
              {label}
            </label>
          ))}
        </div>
        <aside className="panel">
          <h3>Your order</h3>
          {cart.map(({ product, qty }) => (
            <div key={product.id} className="mini-line">
              <span>{product.emoji} {product.name} × {qty}</span>
              <span>{formatPrice(product.price * qty)}</span>
            </div>
          ))}
          <Summary totals={totals} />
          {submitError && <p className="alert">{submitError}</p>}
          <button type="submit" className="btn block" disabled={submitting}>
            {submitting ? 'Placing order…' : `Place order · ${formatPrice(totals.total)}`}
          </button>
          <Link to="/cart" className="link-btn">← Back to cart</Link>
        </aside>
      </form>
    </>
  );
}
