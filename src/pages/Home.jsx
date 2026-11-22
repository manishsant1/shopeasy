import { useEffect, useMemo, useState } from 'react';
import { getCategories, getProducts } from '../api/api';
import ProductCard from '../components/ProductCard';

const SORTS = {
  featured: () => 0,
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  rating: (a, b) => b.rating - a.rating,
  name: (a, b) => a.name.localeCompare(b.name),
};

export default function Home() {
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('featured');
  const [maxPrice, setMaxPrice] = useState(200);
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => {
    Promise.all([getProducts(), getCategories()])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
      })
      .catch((err) => setError(err.message));
  }, []);

  const visible = useMemo(() => {
    if (!products) return [];
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => category === 'All' || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      .filter((p) => p.price <= maxPrice)
      .filter((p) => !inStockOnly || p.stock > 0)
      .sort(SORTS[sort]);
  }, [products, query, category, sort, maxPrice, inStockOnly]);

  return (
    <>
      <section className="hero">
        <h1>Everything you need, delivered.</h1>
        <p>Free shipping on orders over $50.</p>
      </section>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search products…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="featured">Featured</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="rating">Top rated</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <div className="chips">
        {['All', ...categories].map((c) => (
          <button key={c} className={`chip ${c === category ? 'active' : ''}`} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="filters">
        <label>
          Max price: <strong>${maxPrice}</strong>
          <input type="range" min="5" max="200" step="5" value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
          In stock only
        </label>
      </div>

      {error ? (
        <p className="alert">{error}</p>
      ) : !products ? (
        <p className="muted">Loading products…</p>
      ) : visible.length === 0 ? (
        <p className="empty">No products match your filters.</p>
      ) : (
        <>
          <p className="muted small">{visible.length} products</p>
          <div className="grid">
            {visible.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </>
      )}
    </>
  );
}
