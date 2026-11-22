import { test, expect, card, fillShipping, SHIPPING } from '../support/fixtures.js';

async function addAndOpenCheckout(page, name) {
  await page.goto('/');
  await card(page, name).getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('link', { name: /Cart/ }).click();
  await page.getByRole('link', { name: 'Proceed to checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
}

test.describe('checkout', () => {
  test('visiting checkout with an empty cart redirects to the cart', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/cart$/);
  });

  test('happy path: place an order and see it in Orders', async ({ page }) => {
    await addAndOpenCheckout(page, 'Ceramic Mug Set'); // 24.00 + 5.99 shipping + 1.92 tax = 31.91
    await fillShipping(page);
    await page.getByLabel('UPI / wallet').check();
    await expect(page.getByRole('button', { name: /Place order · \$31\.91/ })).toBeVisible();
    await page.getByRole('button', { name: /Place order/ }).click();

    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByText(/Your order ORD-[A-Z0-9]+ has been placed/)).toBeVisible();
    const order = page.locator('.order').first();
    await expect(order).toContainText('Ceramic Mug Set × 1');
    await expect(order).toContainText('$31.91');
    await expect(order).toContainText(`Ship to ${SHIPPING.fullName}, ${SHIPPING.address}`);
    await expect(page.locator('.cart-link .badge')).toHaveCount(0); // cart was cleared
  });

  test('client-side validation shows per-field errors and sends nothing', async ({ page }) => {
    await addAndOpenCheckout(page, 'Football');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Phone').fill('abc');
    await page.getByRole('button', { name: /Place order/ }).click();
    await expect(page.getByText('Required')).toHaveCount(4);
    await expect(page.getByText('Enter a valid email')).toBeVisible();
    await expect(page.getByText('Enter a valid phone number')).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
  });

  test('shipping address is remembered for the next checkout', async ({ page }) => {
    await addAndOpenCheckout(page, 'Football');
    await fillShipping(page);
    await page.getByRole('button', { name: /Place order/ }).click();
    await expect(page).toHaveURL(/\/orders$/);
    await addAndOpenCheckout(page, 'Dark Chocolate');
    await expect(page.getByLabel('Full name')).toHaveValue(SHIPPING.fullName);
  });

  test('server prices are authoritative: tampered client prices are ignored', async ({ page }) => {
    await page.goto('/');
    await card(page, 'Smart Watch').getByRole('button', { name: 'Add to cart' }).click();
    // Forge a cheap price in the stored cart snapshot.
    await page.evaluate(() => {
      const cart = JSON.parse(localStorage.getItem('shopeasy:cart'));
      cart[0].product.price = 0.01;
      localStorage.setItem('shopeasy:cart', JSON.stringify(cart));
    });
    await page.goto('/checkout');
    await fillShipping(page);
    await page.getByRole('button', { name: /Place order/ }).click();
    await expect(page).toHaveURL(/\/orders$/);
    // Real price: 149.00 subtotal, free shipping, 11.92 tax.
    await expect(page.locator('.order').first()).toContainText('$160.92');
  });

  test('stock conflict (409) is shown and nothing is ordered', async ({ page, placeOrderViaApi }) => {
    // Winter Jacket has 8 in stock and is used only by this test.
    await page.goto('/product/p8');
    await page.locator('.qty').getByRole('button', { name: '+' }).click();
    await page.getByRole('button', { name: 'Add to cart' }).click(); // qty 2 in this shopper's cart
    // Someone else buys all 8 while this shopper is browsing.
    const res = await placeOrderViaApi([{ id: 'p8', qty: 8 }]);
    expect(res.status()).toBe(201);

    await page.goto('/checkout');
    await fillShipping(page);
    await page.getByRole('button', { name: /Place order/ }).click();
    await expect(page.locator('.alert')).toContainText('Winter Jacket is out of stock');
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole('button', { name: /Place order/ })).toBeEnabled();

    await page.goto('/orders');
    await expect(page.getByText("You haven't placed any orders yet.")).toBeVisible();
  });
});

test.describe('orders', () => {
  test('a new client sees no orders', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByText("You haven't placed any orders yet.")).toBeVisible();
  });

  test('orders are scoped to the browser (client id)', async ({ page, placeOrderViaApi }) => {
    expect((await placeOrderViaApi([{ id: 'p18', qty: 1 }])).status()).toBe(201); // someone else's order
    await page.goto('/orders');
    await expect(page.getByText("You haven't placed any orders yet.")).toBeVisible();
  });
});
