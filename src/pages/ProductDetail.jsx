import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getProduct } from '../api/api';
import { formatPrice, useStore } from '../context/StoreContext';
import Rating from '../components/Rating';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, isWishlisted } = useStore();
  const [product, setProduct] = useState(undefined);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setProduct(undefined);
    setError(null);
    setQty(1);
    getProduct(id).then(setProduct).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <p className="alert">{error}</p>;
  if (product === undefined) return <p className="muted">Loading…</p>;
  if (product === null) return <p className="empty">Product not found. <Link to="/">Back to shop</Link></p>;

  const outOfStock = product.stock === 0;

  const handleAdd = () => {
    addToCart(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="detail">
      <button className="link-btn" onClick={() => navigate(-1)}>← Back</button>
      <div className="detail-grid">
        <div className="thumb large">{product.emoji}</div>
        <div>
          <span className="muted">{product.category}</span>
          <h1>{product.name}</h1>
          <Rating value={product.rating} />
          <div className="price big">{formatPrice(product.price)}</div>
          <p>{product.description}</p>
          <p className={outOfStock ? 'danger' : 'success'}>
            {outOfStock ? 'Out of stock' : product.stock < 10 ? `Only ${product.stock} left!` : 'In stock'}
          </p>
          {!outOfStock && (
            <div className="row">
              <div className="qty">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <span>{qty}</span>
                <button onClick={() => setQty((q) => Math.min(product.stock, q + 1))}>+</button>
              </div>
              <button className="btn" onClick={handleAdd}>{added ? '✓ Added' : 'Add to cart'}</button>
            </div>
          )}
          <button className="btn secondary" onClick={() => toggleWishlist(product)}>
            {isWishlisted(product.id) ? '♥ In wishlist' : '♡ Add to wishlist'}
          </button>
        </div>
      </div>
    </div>
  );
}
