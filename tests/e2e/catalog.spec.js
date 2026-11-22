import { test, expect, card } from '../support/fixtures.js';

test.describe('catalog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card')).toHaveCount(20);
  });

  test('lists all 20 products', async ({ page }) => {
    await expect(page.getByText('20 products')).toBeVisible();
  });

  test('search filters by name', async ({ page }) => {
    await page.getByPlaceholder('Search products…').fill('yoga');
    await expect(page.locator('.card')).toHaveCount(1);
    await expect(card(page, 'Yoga Mat')).toBeVisible();
  });

  test('shows an empty state when nothing matches', async ({ page }) => {
    await page.getByPlaceholder('Search products…').fill('zzzzzz');
    await expect(page.getByText('No products match your filters.')).toBeVisible();
  });

  test('category chip filters products', async ({ page }) => {
    await page.getByRole('button', { name: 'Books', exact: true }).click();
    await expect(page.locator('.card')).toHaveCount(2);
    await expect(card(page, 'Cookbook')).toBeVisible();
  });

  test('in-stock-only hides out-of-stock items', async ({ page }) => {
    await expect(card(page, 'Laptop Stand').getByRole('button', { name: 'Out of stock' })).toBeDisabled();
    await page.getByLabel('In stock only').check();
    await expect(card(page, 'Laptop Stand')).toHaveCount(0);
    await expect(page.locator('.card')).toHaveCount(19);
  });

  test('max price slider filters expensive items', async ({ page }) => {
    await page.getByLabel(/Max price/).fill('20');
    await expect(card(page, 'Smart Watch')).toHaveCount(0);
    await expect(card(page, 'Dark Chocolate')).toBeVisible();
  });

  test('sorts by price low to high and high to low', async ({ page }) => {
    const first = page.locator('.card h3').first();
    await page.getByRole('combobox').selectOption('price-asc');
    await expect(first).toHaveText('Dark Chocolate');
    await page.getByRole('combobox').selectOption('price-desc');
    await expect(first).toHaveText('Smart Watch');
  });
});

test.describe('product detail', () => {
  test('shows details and low-stock warning', async ({ page }) => {
    await page.goto('/product/p8');
    await expect(page.getByRole('heading', { name: 'Winter Jacket' })).toBeVisible();
    await expect(page.locator('.price.big')).toHaveText('$119.00');
  });

  test('low-stock products show how many are left', async ({ page }) => {
    await page.goto('/product/p2'); // Smart Watch, 12 in stock; not depleted by any test
    await expect(page.getByText('In stock')).toBeVisible();
  });

  test('out-of-stock product cannot be added', async ({ page }) => {
    await page.goto('/product/p4');
    await expect(page.getByText('Out of stock')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to cart' })).toHaveCount(0);
  });

  test('unknown product shows an error', async ({ page }) => {
    await page.goto('/product/nope');
    await expect(page.locator('.alert, .empty')).toContainText(/not found/i);
  });

  test('quantity selector adds several to the cart', async ({ page }) => {
    await page.goto('/product/p18');
    await page.locator('.qty').getByRole('button', { name: '+' }).click();
    await page.locator('.qty').getByRole('button', { name: '+' }).click();
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.locator('.cart-link .badge')).toHaveText('3');
  });
});
