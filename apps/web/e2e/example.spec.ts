import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  // You might need to change this depending on the actual title of the MicroChat app
  await expect(page).toHaveTitle(/MicroChat/i);
});
