import { test, expect } from '@playwright/test';

test('Queue page renders (E2E mode)', async ({ page }) => {
  await page.goto('/brand-select');
  await page.getByRole('button').filter({ hasText: 'TL' }).first().click();

  await page.goto('/queue');
  await expect(page.getByRole('heading', { name: '要入力キュー' })).toBeVisible();

  // E2E fixtures return no campaigns, so the empty state should be visible.
  await expect(page.getByText('要入力の案件がありません')).toBeVisible();
});

