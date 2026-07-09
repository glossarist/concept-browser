import { test, expect } from '@playwright/test';

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});

test('dataset page loads', async ({ page }) => {
  await page.goto('/');
  const firstLink = page.locator('a[href*="/dataset/"]').first();
  if (await firstLink.isVisible()) {
    await firstLink.click();
    await expect(page.locator('h1')).toBeVisible();
  }
});

test('search works', async ({ page }) => {
  await page.goto('/search');
  await expect(page.locator('input[type="search"]')).toBeVisible();
});

test('dark mode toggle works', async ({ page }) => {
  await page.goto('/');
  const toggle = page.locator('#theme-toggle');
  if (await toggle.isVisible()) {
    const wasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await toggle.click();
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBe(!wasDark);
  }
});
