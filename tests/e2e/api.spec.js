import { test, expect, SHIPPING } from '../support/fixtures.js';

const headers = { 'X-Client-Id': 'api-test-client-0001' };

test.describe('API contract (what the UI relies on)', () => {
  test('health and catalog endpoints', async ({ request }) => {
    expect((await request.get('/api/health')).ok()).toBe(true);
    const products = await (await request.get('/api/products')).json();
    expect(products).toHaveLength(20);
    expect(typeof products[0].price).toBe('number');
    expect(await (await request.get('/api/categories')).json()).toContain('Books');
  });

  test('orders require a valid X-Client-Id', async ({ request }) => {
    expect((await request.get('/api/orders')).status()).toBe(400);
  });

  test('invalid shipping returns per-field details', async ({ request }) => {
    const res = await request.post('/api/orders', {
      headers, data: { items: [{ id: 'p18', qty: 1 }], shipping: { ...SHIPPING, email: 'x' }, payment: 'cod' },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).details).toEqual({ email: 'Enter a valid email' });
  });

  test('rejects an empty cart and an invalid payment method', async ({ request }) => {
    const empty = await request.post('/api/orders', { headers, data: { items: [], shipping: SHIPPING, payment: 'cod' } });
    expect(empty.status()).toBe(400);
    const pay = await request.post('/api/orders', {
      headers, data: { items: [{ id: 'p18', qty: 1 }], shipping: SHIPPING, payment: 'bitcoin' },
    });
    expect(pay.status()).toBe(400);
  });

  test('client-sent prices are ignored', async ({ request }) => {
    const res = await request.post('/api/orders', {
      headers: { 'X-Client-Id': 'api-test-client-0002' },
      data: { items: [{ id: 'p19', qty: 1, price: 0.01 }], total: 0.01, shipping: SHIPPING, payment: 'card' },
    });
    expect(res.status()).toBe(201);
    expect((await res.json()).subtotal).toBe(11);
  });

  test('ordering more than the stock is rejected with 409', async ({ request }) => {
    const res = await request.post('/api/orders', {
      headers, data: { items: [{ id: 'p4', qty: 1 }], shipping: SHIPPING, payment: 'cod' },
    });
    expect(res.status()).toBe(409);
  });
});
