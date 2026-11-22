import { randomUUID } from 'node:crypto';
import { test as base, expect } from '@playwright/test';

export const SHIPPING = {
  fullName: 'Test Shopper',
  email: 'shopper@example.com',
  address: '1 Test Street',
  city: 'Testville',
  zip: '12345',
  phone: '+1 555 0100',
};

// Every test gets a fresh browser context = fresh localStorage = a brand-new client ID,
// so carts, wishlists and orders never leak between tests.
export const test = base.extend({
  // Place an order as a different (throw-away) client straight through the API.
  placeOrderViaApi: async ({ request }, use) => {
    await use((items, clientId = randomUUID()) =>
      request.post('/api/orders', {
        headers: { 'X-Client-Id': clientId },
        data: { items, shipping: SHIPPING, payment: 'cod' },
      }));
  },
});

export const card = (page, name) =>
  page.locator('.card', { has: page.getByRole('heading', { name, exact: true }) });

export async function fillShipping(page, data = SHIPPING) {
  const fields = [['Full name', 'fullName'], ['Email', 'email'], ['Street address', 'address'],
    ['City', 'city'], ['ZIP / Postal code', 'zip'], ['Phone', 'phone']];
  for (const [label, key] of fields) await page.getByLabel(label).fill(data[key]);
}

export { expect };
