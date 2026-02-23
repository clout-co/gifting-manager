import { test, expect } from '@playwright/test';

test('Create Campaign (SSO bypass + Master stub)', async ({ page }) => {
  // In E2E mode, hooks/APIs are stubbed to avoid flakiness from Supabase RLS + external deps.
  const influencerHandle = 'e2e_insta';

  await page.goto('/brand-select');
  await page.getByRole('button').filter({ hasText: 'TL' }).first().click();

  await page.goto('/campaigns');
  await page.getByRole('button', { name: '新規案件', exact: true }).click();

  // Influencer: type and select via Enter.
  const influencerInput = page.getByLabel('インフルエンサー');
  await influencerInput.fill(influencerHandle);
  await page.keyboard.press('Enter');
  await expect(influencerInput).toHaveValue(`@${influencerHandle}`);

  // Product: type (Master stub resolves TF-2408 with cost).
  const productInput = page.getByLabel('品番');
  await productInput.fill('TF2408');
  await expect(page.getByText('確定', { exact: true })).toBeVisible();

  const registerButton = page.getByRole('button', { name: '登録', exact: true });

  // Sale date may be auto-filled from Product Master.
  const saleDateInput = page.getByLabel('セール日');
  const currentSaleDate = await saleDateInput.inputValue();
  if (!currentSaleDate) {
    const saleDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await saleDateInput.fill(saleDate);
  }
  await expect(registerButton).toBeEnabled();

  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/campaigns') && r.request().method() === 'POST' && r.status() === 200),
    registerButton.click(),
  ]);

  const json = await res.json().catch(() => null);
  expect(json && typeof json.id === 'string').toBeTruthy();

  // Modal should close on success (button exists only inside modal).
  await expect(page.getByRole('button', { name: '登録', exact: true })).toBeHidden();
});
