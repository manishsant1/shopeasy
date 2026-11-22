import { Link } from 'react-router-dom';
import { formatPrice, useStore } from '../context/StoreContext';
import Rating from './Rating';

export default function ProductCard({ product }) {
  const { addToCart, toggleWishlist, isWishlisted } = useStore();
  const outOfStock = product.stock === 0;
  const liked = isWishlisted(product.id);

  return (
    <div className="card">
      <button
        className={`heart ${liked ? 'liked' : ''}`}
        onClick={() => toggleWishlist(product)}
        aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        {liked ? '♥' : '♡'}
      </button>
      <Link to={`/product/${product.id}`} className="card-link">
        <div className="thumb">{product.emoji}</div>
        <div className="card-body">
          <span className="muted small">{product.category}</span>
          <h3>{product.name}</h3>
          <Rating value={product.rating} />
          <div className="price">{formatPrice(product.price)}</div>
        </div>
      </Link>
      <button className="btn" disabled={outOfStock} onClick={() => addToCart(product)}>
        {outOfStock ? 'Out of stock' : 'Add to cart'}
      </button>
    </div>
  );
}
