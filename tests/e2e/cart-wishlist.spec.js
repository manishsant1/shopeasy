import { test, expect, card } from '../support/fixtures.js';

test.describe('cart', () => {
  test('empty cart state', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  });

  test('add, change quantity, and remove', async ({ page }) => {
    await page.goto('/');
    await card(page, 'Cotton T-Shirt').getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.locator('.cart-link .badge')).toHaveText('1');
    await page.getByRole('link', { name: /Cart/ }).click();

    const line = page.locator('.line', { hasText: 'Cotton T-Shirt' });
    await line.getByRole('button', { name: '+' }).click();
    await expect(line.locator('.qty span')).toHaveText('2');
    await expect(line.locator('.line-total')).toHaveText('$29.98');

    await line.getByRole('button', { name: '−' }).click();
    await expect(line.locator('.qty span')).toHaveText('1');
    await line.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  });

  test('totals: shipping fee under $50, free from $50, 8% tax', async ({ page }) => {
    await page.goto('/');
    await card(page, 'Cotton T-Shirt').getByRole('button', { name: 'Add to cart' }).click(); // 14.99
    await page.getByRole('link', { name: /Cart/ }).click();
    await expect(page.getByText('Add $35.01 more for free shipping.')).toBeVisible();
    await expect(page.locator('.summary')).toContainText('$5.99');
    await expect(page.locator('.summary dd.total')).toHaveText('$22.18'); // 14.99 + 5.99 + 1.20

    // Add Denim Jeans (49.99): subtotal 64.98, free shipping, tax 5.20
    await page.getByRole('link', { name: 'Shop', exact: true }).click();
    await card(page, 'Denim Jeans').getByRole('button', { name: 'Add to cart' }).click();
    await page.getByRole('link', { name: /Cart/ }).click();
    await expect(page.locator('.summary')).toContainText('Free');
    await expect(page.locator('.summary dd.total')).toHaveText('$70.18');
  });

  test('cart persists across reloads', async ({ page }) => {
    await page.goto('/');
    await card(page, 'Football').getByRole('button', { name: 'Add to cart' }).click();
    await page.reload();
    await expect(page.locator('.cart-link .badge')).toHaveText('1');
  });

  test('clear cart empties it', async ({ page }) => {
    await page.goto('/');
    await card(page, 'Football').getByRole('button', { name: 'Add to cart' }).click();
    await page.getByRole('link', { name: /Cart/ }).click();
    await page.getByRole('button', { name: 'Clear cart' }).click();
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  });
});

test.describe('wishlist', () => {
  test('toggle from the grid and view on the wishlist page', async ({ page }) => {
    await page.goto('/');
    await card(page, 'Yoga Mat').getByRole('button', { name: 'Add to wishlist' }).click();
    await expect(page.getByRole('link', { name: 'Wishlist (1)' })).toBeVisible();
    await page.getByRole('link', { name: /Wishlist/ }).click();
    await expect(card(page, 'Yoga Mat')).toBeVisible();

    await card(page, 'Yoga Mat').getByRole('button', { name: 'Remove from wishlist' }).click();
    await expect(page.getByText('Tap ♡ on any product to save it here.')).toBeVisible();
  });

  test('toggle from the product page and persist after reload', async ({ page }) => {
    await page.goto('/product/p11');
    await page.getByRole('button', { name: '♡ Add to wishlist' }).click();
    await expect(page.getByRole('button', { name: '♥ In wishlist' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: '♥ In wishlist' })).toBeVisible();
  });
});
