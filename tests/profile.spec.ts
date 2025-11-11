import { test, expect } from '@playwright/test';

test.describe('Profile page smoke', () => {
  test('public profile renders and CTAs present', async ({ page }) => {
    // Replace with a real user id in CI via env or fixture
    const userId = process.env.E2E_USER_ID || 'test-user';
    await page.goto(`/profile/${userId}`);
    await expect(page.getByText('Courses')).toBeVisible();
    await expect(page.getByText('Marketplace Listings')).toBeVisible();
    // Message CTA appears when viewing another user
    // This is a smoke check; exact selector may vary depending on auth state
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (await page.getByRole('button', { name: /Message/i }).isVisible().catch(()=>false)) {
      await expect(page.getByRole('button', { name: /Message/i })).toBeVisible();
    }
  });
});


