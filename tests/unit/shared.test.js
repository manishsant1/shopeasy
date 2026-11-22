// Unit tests for the code shared by the browser and the server. Run with `npm run test:unit`
// (Node's built-in test runner, no extra dependencies).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderTotals, SHIPPING_FEE, SHIPPING_THRESHOLD, TAX_RATE } from '../../shared/pricing.js';
import { PAYMENT_METHODS, SHIPPING_FIELDS, validateShipping } from '../../shared/validation.js';

const valid = {
  fullName: 'Test Shopper',
  email: 'shopper@example.com',
  address: '1 Test Street',
  city: 'Testville',
  zip: '12345',
  phone: '+1 555 0100',
};

test('orderTotals charges shipping below the free-shipping threshold', () => {
  const t = orderTotals(14.99);
  assert.equal(t.shipping, SHIPPING_FEE);
  assert.equal(t.tax, 1.2);
  assert.equal(t.total, 22.18);
});

test('orderTotals gives free shipping at and above the threshold', () => {
  assert.equal(orderTotals(SHIPPING_THRESHOLD).shipping, 0);
  assert.equal(orderTotals(64.98).total, 70.18);
});

test('orderTotals of an empty cart is all zeros', () => {
  assert.deepEqual(orderTotals(0), { subtotal: 0, shipping: 0, tax: 0, total: 0 });
});

test('orderTotals applies the tax rate and rounds to cents', () => {
  const t = orderTotals(149);
  assert.equal(t.tax, Math.round(149 * TAX_RATE * 100) / 100);
  assert.equal(t.total, 160.92);
});

test('validateShipping accepts a complete valid form', () => {
  assert.deepEqual(validateShipping(valid), {});
});

test('validateShipping reports every missing field as Required', () => {
  const errors = validateShipping({});
  assert.equal(Object.keys(errors).length, SHIPPING_FIELDS.length);
  assert.ok(Object.values(errors).every((m) => m === 'Required'));
});

test('validateShipping rejects whitespace-only values', () => {
  assert.equal(validateShipping({ ...valid, city: '   ' }).city, 'Required');
});

test('validateShipping checks the email and phone formats', () => {
  assert.equal(validateShipping({ ...valid, email: 'nope' }).email, 'Enter a valid email');
  assert.equal(validateShipping({ ...valid, phone: 'abc' }).phone, 'Enter a valid phone number');
});

test('validateShipping rejects values over 200 characters', () => {
  assert.equal(validateShipping({ ...valid, address: 'x'.repeat(201) }).address, 'Too long');
});

test('payment methods are card, cod and upi', () => {
  assert.deepEqual(PAYMENT_METHODS.map(([value]) => value), ['card', 'cod', 'upi']);
});
