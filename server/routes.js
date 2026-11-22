import express from 'express';
import * as db from './db.js';
import { HttpError } from './errors.js';
import { counter } from './telemetry.js';

// Orders created and 409 stock conflicts are derived from the HTTP metrics (POST 201 / status 409),
// so only what HTTP cannot show is counted here.
const ordersCreated = counter('shopeasy.orders.created', 'Orders successfully placed, by payment method');
const orderRevenue = counter('shopeasy.orders.revenue', 'Sum of order totals placed');
import { PAYMENT_METHODS, SHIPPING_FIELDS, validateShipping } from '../shared/validation.js';

const router = express.Router();

// Until there are user accounts, each browser sends a random ID it generated itself,
// so it sees only its own orders. Replace this with the signed-in user's ID when
// authentication is added.
function requireClientId(req) {
  const id = req.get('X-Client-Id');
  if (!id || !/^[\w-]{8,64}$/.test(id)) throw new HttpError(400, 'Missing or invalid X-Client-Id header');
  return id;
}

// Checks the shape of the cart and merges repeated product IDs into one line.
function parseItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Your cart is empty');
  if (items.length > 100) throw new HttpError(400, 'Too many items in one order');
  const qtyById = new Map();
  for (const item of items) {
    const { id, qty } = item ?? {};
    if (typeof id !== 'string' || !Number.isInteger(qty) || qty < 1 || qty > 1000) {
      throw new HttpError(400, 'Invalid item in cart');
    }
    qtyById.set(id, (qtyById.get(id) ?? 0) + qty);
  }
  return [...qtyById].map(([id, qty]) => ({ id, qty }));
}

router.get('/health', async (req, res) => {
  await db.ping();
  res.json({ ok: true });
});

router.get('/categories', async (req, res) => res.json(await db.getCategories()));

router.get('/products', async (req, res) => res.json(await db.getProducts()));

router.get('/products/:id', async (req, res) => {
  const product = await db.getProduct(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found');
  res.json(product);
});

router.get('/orders', async (req, res) => {
  res.json(await db.getOrdersForClient(requireClientId(req)));
});

router.post('/orders', async (req, res) => {
  const clientId = requireClientId(req);
  const { items, shipping = {}, payment } = req.body ?? {};

  const errors = validateShipping(shipping);
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields', errors);
  if (!PAYMENT_METHODS.some(([value]) => value === payment)) throw new HttpError(400, 'Invalid payment method');

  // Prices and stock come from the database, never from the request.
  const order = await db.createOrder({
    clientId,
    items: parseItems(items),
    // Keep only the known fields, trimmed.
    shipping: Object.fromEntries(SHIPPING_FIELDS.map((f) => [f.name, shipping[f.name].trim()])),
    payment,
  });
  ordersCreated.add(1, { payment });
  orderRevenue.add(order.total);
  res.status(201).json(order);
});

router.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Express 5 forwards errors thrown in handlers (sync or async) to this handler.
router.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

export default router;
