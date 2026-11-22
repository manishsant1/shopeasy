import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import ProductCard from '../components/ProductCard';

export default function Wishlist() {
  const { wishlist } = useStore();
  return (
    <>
      <h1>Wishlist</h1>
      {wishlist.length === 0 ? (
        <div className="empty">
          <p>Tap ♡ on any product to save it here.</p>
          <Link to="/" className="btn">Browse products</Link>
        </div>
      ) : (
        <div className="grid">
          {wishlist.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </>
  );
}
