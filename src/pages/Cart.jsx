import { Link } from 'react-router-dom';
import { formatPrice, orderTotals, SHIPPING_THRESHOLD, useStore } from '../context/StoreContext';
import Summary from '../components/Summary';

export default function Cart() {
  const { cart, subtotal, updateQty, removeFromCart, clearCart } = useStore();

  if (cart.length === 0) {
    return (
      <div className="empty">
        <h2>Your cart is empty</h2>
        <Link to="/" className="btn">Start shopping</Link>
      </div>
    );
  }

  const totals = orderTotals(subtotal);
  const remaining = SHIPPING_THRESHOLD - subtotal;

  return (
    <>
      <h1>Shopping cart</h1>
      <div className="two-col">
        <div>
          {cart.map(({ product, qty }) => (
            <div key={product.id} className="line">
              <div className="thumb small">{product.emoji}</div>
              <div className="line-info">
                <Link to={`/product/${product.id}`}><strong>{product.name}</strong></Link>
                <span className="muted small">{formatPrice(product.price)} each</span>
              </div>
              <div className="qty">
                <button onClick={() => updateQty(product.id, qty - 1)}>−</button>
                <span>{qty}</span>
                <button onClick={() => updateQty(product.id, qty + 1)} disabled={qty >= product.stock}>+</button>
              </div>
              <strong className="line-total">{formatPrice(qty * product.price)}</strong>
              <button className="link-btn danger" onClick={() => removeFromCart(product.id)}>Remove</button>
            </div>
          ))}
          <button className="link-btn" onClick={clearCart}>Clear cart</button>
        </div>
        <aside className="panel">
          <h3>Order summary</h3>
          {remaining > 0 && (
            <p className="note">Add {formatPrice(remaining)} more for free shipping.</p>
          )}
          <Summary totals={totals} />
          <Link to="/checkout" className="btn block">Proceed to checkout</Link>
        </aside>
      </div>
    </>
  );
}
