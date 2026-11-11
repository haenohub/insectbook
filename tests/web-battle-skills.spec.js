import { test, expect } from '@playwright/test';

test('title abilities explain their effects in the insect detail panel', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '넓적사슴벌레 상세 보기', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: '게임 능력치' }).click();
  await expect(dialog.getByRole('heading', { name: '타이틀로 얻은 스킬' })).toBeVisible();
  const armor = dialog.locator('.skill-entry').filter({ has: page.locator('strong', { hasText: '철벽 갑옷' }) });
  await armor.locator('summary').click();
  await expect(armor.locator('p')).toContainText('최대 HP의 30%');
  await expect(armor.locator('.skill-cooldown')).toContainText('4턴');
  await expect(dialog.locator('.skill-entry strong')).toHaveText(['철벽 갑옷', '급소 사냥', '어둠의 기습', '탐험가의 용기']);
});

test('skills activate visibly, shield and cooldown states update, and the full replay survives skipping', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await page.getByRole('button', { name: '노랑나비 배틀 선택', exact: true }).click();
  await page.getByRole('button', { name: '넓적사슴벌레 배틀 선택', exact: true }).click();
  await page.getByRole('button', { name: '대결하러 가기', exact: false }).click();
  await expect(page.locator('.fighter-abilities')).toHaveCount(2);
  await page.getByRole('button', { name: '배틀 시작하기', exact: false }).click();
  await expect(page.locator('.fighter-action.is-skill').first()).toBeVisible();
  await expect(page.locator('.shield-status')).toBeVisible();
  await expect(page.locator('.battle-log')).toContainText('철벽 갑옷');
  await expect(page.locator('.skill-list')).toContainText(['턴 대기', '턴 대기']);
  await page.getByRole('button', { name: '결과 바로 보기', exact: false }).click();
  await expect(page.locator('.battle-result')).toBeVisible();
  await page.locator('.battle-replay summary').click();
  const replay = page.locator('.battle-replay ol');
  await expect(replay).toContainText('철벽 갑옷');
  await expect(replay).toContainText('눈속임 무늬');
  await expect(replay).toContainText('기본 공격');
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.screenshot({ path: '/tmp/insectbook-title-skills-desktop.png', fullPage: true });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    expect(await page.locator('.skill-entry strong').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/insectbook-title-skills-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
