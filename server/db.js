// Postgres data access, using Neon's serverless driver.
// The Pool talks to Neon over WebSockets, which supports full transactions (needed for orders).
import { randomUUID } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { orderTotals } from '../shared/pricing.js';
import { HttpError } from './errors.js';
import { CATEGORIES, PRODUCTS } from './seed.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add your Neon connection string to .env (see .env.example).');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err) => console.error('Database connection error:', err.message));

// Idempotent, so it is safe to run on every start.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS categories (
    name     text PRIMARY KEY,
    position integer NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    category    text NOT NULL REFERENCES categories(name),
    price       numeric(10, 2) NOT NULL CHECK (price >= 0),
    rating      numeric(2, 1) NOT NULL DEFAULT 0,
    stock       integer NOT NULL CHECK (stock >= 0),
    emoji       text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS orders (
    id           text PRIMARY KEY,
    client_id    text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    status       text NOT NULL DEFAULT 'Processing',
    shipping     jsonb NOT NULL,
    payment      text NOT NULL,
    subtotal     numeric(10, 2) NOT NULL,
    shipping_fee numeric(10, 2) NOT NULL,
    tax          numeric(10, 2) NOT NULL,
    total        numeric(10, 2) NOT NULL
  );
  CREATE INDEX IF NOT EXISTS orders_client_created_idx ON orders (client_id, created_at DESC);

  -- Name, emoji and price are copied at purchase time so past orders don't change
  -- when the catalog does.
  CREATE TABLE IF NOT EXISTS order_items (
    order_id   text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id text NOT NULL REFERENCES products(id),
    name       text NOT NULL,
    emoji      text NOT NULL,
    price      numeric(10, 2) NOT NULL,
    qty        integer NOT NULL CHECK (qty > 0),
    PRIMARY KEY (order_id, product_id)
  );
`;

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Creates the tables and, on an empty database, loads the starter catalog.
export async function init() {
  await pool.query(SCHEMA);
  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT count(*)::int AS n FROM products');
    if (rows[0].n > 0) return;
    for (const [i, name] of CATEGORIES.entries()) {
      await client.query(
        'INSERT INTO categories (name, position) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [name, i],
      );
    }
    for (const p of PRODUCTS) {
      await client.query(
        `INSERT INTO products (id, name, category, price, rating, stock, emoji, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
        [p.id, p.name, p.category, p.price, p.rating, p.stock, p.emoji, p.description],
      );
    }
    console.log(`Seeded ${PRODUCTS.length} products`);
  });
}

export async function ping() {
  await pool.query('SELECT 1');
}

// Postgres returns numeric columns as strings to avoid precision loss; prices fit in a JS number.
const toProduct = (r) => ({ ...r, price: Number(r.price), rating: Number(r.rating) });

export async function getCategories() {
  const { rows } = await pool.query('SELECT name FROM categories ORDER BY position, name');
  return rows.map((r) => r.name);
}

export async function getProducts() {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY id');
  return rows.map(toProduct);
}

export async function getProduct(id) {
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  return rows[0] ? toProduct(rows[0]) : null;
}

export async function getOrdersForClient(clientId) {
  const { rows } = await pool.query(
    `SELECT o.id, o.created_at, o.status, o.shipping, o.payment,
            o.subtotal, o.shipping_fee, o.tax, o.total,
            json_agg(json_build_object(
              'id', i.product_id, 'name', i.name, 'emoji', i.emoji, 'price', i.price, 'qty', i.qty
            ) ORDER BY i.name) AS items
       FROM orders o
       JOIN order_items i ON i.order_id = o.id
      WHERE o.client_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC`,
    [clientId],
  );
  return rows.map(toOrder);
}

function toOrder(r) {
  return {
    id: r.id,
    createdAt: r.created_at,
    status: r.status,
    shipping: r.shipping,
    payment: r.payment,
    subtotal: Number(r.subtotal),
    shippingFee: Number(r.shipping_fee),
    tax: Number(r.tax),
    total: Number(r.total),
    items: r.items.map((i) => ({ ...i, price: Number(i.price) })),
  };
}

// Checks stock, charges the database's current prices and records the order, all in one
// transaction. `items` must already be validated as [{ id, qty }] with positive integer qty.
export async function createOrder({ clientId, items, shipping, payment }) {
  return withTransaction(async (client) => {
    // Lock the rows being bought so two checkouts can't both take the last item.
    const ids = items.map((i) => i.id);
    const { rows } = await client.query(
      'SELECT * FROM products WHERE id = ANY($1) ORDER BY id FOR UPDATE',
      [ids],
    );
    const products = new Map(rows.map((r) => [r.id, toProduct(r)]));

    const lines = items.map(({ id, qty }) => {
      const product = products.get(id);
      if (!product) throw new HttpError(400, `Product ${id} no longer exists`);
      if (qty > product.stock) {
        throw new HttpError(409, product.stock === 0
          ? `${product.name} is out of stock`
          : `Only ${product.stock} ${product.name} left in stock`);
      }
      return { product, qty };
    });

    const totals = orderTotals(lines.reduce((sum, l) => sum + l.product.price * l.qty, 0));
    const orderId = 'ORD-' + randomUUID().slice(0, 8).toUpperCase();

    const { rows: [order] } = await client.query(
      `INSERT INTO orders (id, client_id, shipping, payment, subtotal, shipping_fee, tax, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_at, status, shipping, payment, subtotal, shipping_fee, tax, total`,
      [orderId, clientId, shipping, payment, totals.subtotal, totals.shipping, totals.tax, totals.total],
    );

    for (const { product, qty } of lines) {
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [qty, product.id]);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, name, emoji, price, qty)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, product.id, product.name, product.emoji, product.price, qty],
      );
    }

    return toOrder({
      ...order,
      items: lines.map(({ product, qty }) => ({
        id: product.id, name: product.name, emoji: product.emoji, price: product.price, qty,
      })),
    });
  });
}

export async function close() {
  await pool.end();
}
