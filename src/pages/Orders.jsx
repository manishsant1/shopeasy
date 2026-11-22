import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getOrders } from '../api/api';
import { formatPrice } from '../context/StoreContext';

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const justPlaced = useLocation().state?.justPlaced;

  useEffect(() => {
    getOrders().then(setOrders).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="alert">{error}</p>;
  if (!orders) return <p className="muted">Loading orders…</p>;

  return (
    <>
      {justPlaced && (
        <div className="banner">🎉 Thank you! Your order <strong>{justPlaced}</strong> has been placed.</div>
      )}
      <h1>Your orders</h1>
      {orders.length === 0 ? (
        <div className="empty">
          <p>You haven't placed any orders yet.</p>
          <Link to="/" className="btn">Start shopping</Link>
        </div>
      ) : (
        orders.map((o) => (
          <div key={o.id} className={`panel order ${o.id === justPlaced ? 'highlight' : ''}`}>
            <div className="order-head">
              <div>
                <strong>{o.id}</strong>
                <div className="muted small">{new Date(o.createdAt).toLocaleString()}</div>
              </div>
              <span className="status">{o.status}</span>
              <strong>{formatPrice(o.total)}</strong>
            </div>
            {o.items.map((i) => (
              <div key={i.id} className="mini-line">
                <span>{i.emoji} {i.name} × {i.qty}</span>
                <span>{formatPrice(i.price * i.qty)}</span>
              </div>
            ))}
            <div className="muted small">
              Ship to {o.shipping.fullName}, {o.shipping.address}, {o.shipping.city} {o.shipping.zip}
            </div>
          </div>
        ))
      )}
    </>
  );
}
