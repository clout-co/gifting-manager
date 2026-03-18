import { test, expect } from '@playwright/test';

test('Influencer detail loads through BFF and shows payout form section', async ({ page }) => {
  await page.goto('/brand-select');
  await page.getByRole('button').filter({ hasText: 'TL' }).first().click();

  await page.goto('/influencers/e2e-influencer-tl');

  await expect(page.getByRole('heading', { name: '@e2e_insta' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '請求先情報フォーム' })).toBeVisible();
  await expect(page.getByText('フォームリンク未発行')).toBeVisible();
});
