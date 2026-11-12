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

test('manual support targets allies, displays shields and cooldowns, and locks the team during an expedition', async ({ page }) => {
  await page.goto('./?view=battle');
  const names = ['넓적사슴벌레', '검정명주딱정벌레', '각시메뚜기'];
  for (let n = 0; n < names.length; n++) {
    await page.getByRole('button', { name: `${n + 1}번 친구 고르기`, exact: false }).click();
    await page.getByRole('textbox', { name: '배틀 선수 검색' }).fill(names[n]);
    await page.getByRole('dialog').getByRole('button', { name: `${names[n]} 선택`, exact: true }).click();
  }
  await page.getByRole('button', { name: '보스 도전 시작', exact: false }).click();
  const first = page.locator('.raid-ally').nth(0);
  await first.getByRole('button', { name: '철벽 갑옷', exact: false }).click();
  await first.getByRole('combobox', { name: '넓적사슴벌레 지원 대상' }).selectOption('ally-2');
  for (const card of (await page.locator('.raid-ally').all()).slice(1)) await card.getByRole('button', { name: '기본 공격', exact: false }).click();
  await page.getByRole('button', { name: '행동 확정 · 턴 진행', exact: false }).click();
  await page.getByRole('button', { name: '턴 결과 바로 보기', exact: false }).click();
  await expect(page.locator('.raid-ally').nth(2).locator('.raid-conditions')).toContainText('보호막');
  await expect(first.getByRole('button', { name: '철벽 갑옷', exact: false })).toBeDisabled();
  await expect(first).toContainText('4턴 대기');
  await expect(page.locator('.raid-log')).toContainText('각시메뚜기 보호막');
  await page.locator('.site-header nav').getByRole('button', { name: '곤충도감', exact: true }).click();
  await page.getByRole('button', { name: '노랑나비 배틀 선택', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('탐험을 종료한 뒤');
  await page.locator('.site-header nav').getByRole('button', { name: '보스 도전', exact: false }).click();
  await expect(page.locator('.raid-turn-label')).toContainText('TURN 2');
  await page.screenshot({ path: '/tmp/insectbook-boss-raid-desktop.png', fullPage: true });
});
