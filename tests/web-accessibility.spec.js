import { test, expect } from '@playwright/test';

test('mobile feature filters contain focus, isolate the background and restore the trigger on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const trigger = page.getByRole('button', { name: '특징', exact: true });
  await trigger.click();
  const panel = page.getByRole('dialog', { name: '특징으로 찾아보기' });
  const close = panel.getByRole('button', { name: '필터 닫기' });
  const results = panel.getByRole('button', { name: '종 결과 보기', exact: false });
  await expect(panel).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(close).toBeFocused();
  expect(await page.locator('.site-header').evaluate(el => el.inert)).toBeTruthy();
  await page.keyboard.press('Shift+Tab');
  await expect(results).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(await page.locator('.site-header').evaluate(el => el.inert)).toBeFalsy();
});

test('the source guide remains available when JavaScript is disabled', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(new URL('./', baseURL).href);
    await expect(page.getByRole('heading', { name: '서치! 곤충도감', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '국립수목원 곤충도감 원문 보기' })).toHaveAttribute('href', /nature\.go\.kr/);
  } finally {
    await context.close();
  }
});
