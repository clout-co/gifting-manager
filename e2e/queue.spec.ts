import { test, expect } from '@playwright/test';

test('Legacy queue route redirects to campaigns needsInput filter', async ({ page }) => {
  await page.goto('/brand-select');
  await page.getByRole('button').filter({ hasText: 'TL' }).first().click();

  await page.goto('/queue');
  await page.waitForURL('**/campaigns?ops=needsInput');
  await expect(page.getByRole('heading', { name: 'ギフティング案件' })).toBeVisible();
  await expect(page.getByRole('button', { name: /要入力/ })).toBeVisible();

  // E2E fixtures return no campaigns, so the empty state should be visible.
  await expect(page.getByText('検索結果がありません')).toBeVisible();
});
