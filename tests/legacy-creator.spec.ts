import { test, expect } from '@playwright/test';

test.describe('Legacy creator kit smoke', () => {
  test('creator kit renders and sample videos visible', async ({ page }) => {
    const slug = process.env.E2E_CREATOR_SLUG || 'placeholder';
    await page.goto(`/creator-kits/${slug}`);
    await expect(page.getByText(/Featured Video/i)).toBeVisible();
    await expect(page.getByText(/Assets/)).toBeVisible();
  });
});


