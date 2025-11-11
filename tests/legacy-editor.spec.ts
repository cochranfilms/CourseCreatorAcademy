import { test, expect } from '@playwright/test';

test.describe('Legacy creator editor smoke', () => {
  test('legacy profile editor renders', async ({ page }) => {
    await page.goto('/creator/legacy/profile');
    await expect(page.getByText(/Edit Legacy Creator Profile/i)).toBeVisible();
  });
});


