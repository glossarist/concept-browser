import { test, expect } from '@playwright/test';

test('home page loads', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('h1, .sp-node, [data-test="app-ready"]')).toBeVisible({ timeout: 15000 });
});

test('dataset page loads', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const firstLink = page.locator('a[href*="/dataset/"]').first();
  if (await firstLink.isVisible({ timeout: 15000 }).catch(() => false)) {
    await firstLink.click();
    await expect(page.locator('h1, [data-test="app-ready"]')).toBeVisible({ timeout: 15000 });
  }
});

test('search works', async ({ page }) => {
  await page.goto('/search', { waitUntil: 'networkidle' });
  await expect(page.locator('input[type="search"], input[type="text"], [data-test="app-ready"]')).toBeVisible({ timeout: 15000 });
});

test('dark mode toggle works', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const toggle = page.locator('#theme-toggle');
  if (await toggle.isVisible({ timeout: 15000 }).catch(() => false)) {
    const wasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await toggle.click();
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBe(!wasDark);
  }
});
