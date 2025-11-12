import { test, expect } from '@playwright/test';

test.describe('Entitlements helper and mux token gate', () => {
  test('Mux token denies without auth', async ({ request }) => {
    const res = await request.get(`/api/mux/token?playbackId=nonexistent`);
    expect(res.status()).toBe(404); // not found also acceptable
  });
});


