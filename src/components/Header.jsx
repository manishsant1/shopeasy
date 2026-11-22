import { Link, NavLink } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

export default function Header() {
  const { cartCount, wishlist } = useStore();
  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">🛍️ ShopEasy</Link>
        <nav className="nav">
          <NavLink to="/" end>Shop</NavLink>
          <NavLink to="/wishlist">Wishlist{wishlist.length > 0 && ` (${wishlist.length})`}</NavLink>
          <NavLink to="/orders">Orders</NavLink>
          <NavLink to="/cart" className="cart-link">
            🛒 Cart {cartCount > 0 && <span className="badge">{cartCount}</span>}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
