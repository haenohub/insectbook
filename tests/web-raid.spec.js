import { test, expect } from '@playwright/test';
import catalog from '../data/web-catalog.json' with { type: 'json' };

async function selectTeam(page, names) {
  await page.goto('./?view=battle');
  for (let n = 0; n < 3; n++) {
    await page.getByRole('button', { name: `${n + 1}번 친구 고르기`, exact: false }).click();
    await page.getByRole('textbox', { name: '배틀 선수 검색' }).fill(names[n]);
    await page.getByRole('dialog').getByRole('button', { name: `${names[n]} 선택`, exact: true }).click();
  }
  await page.getByRole('button', { name: '보스 도전 시작', exact: false }).click();
}

test('a stage clears through selected attacks and the next stage restores the party and changes boss', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => .99; });
  await selectTeam(page, ['넓적사슴벌레', '검정명주딱정벌레', '각시메뚜기']);
  for (let turn = 0; turn < 12; turn++) {
    if (await page.locator('.raid-result.stageClear').count()) break;
    for (const card of await page.locator('.raid-ally:not(.is-down)').all()) {
      let chosen = false;
      for (const name of ['급소 사냥', '도약 강타', '탐험가의 용기', '기본 공격']) {
        const action = card.getByRole('button', { name, exact: false });
        if (await action.count() && await action.isEnabled()) { await action.click(); chosen = true; break; }
      }
      expect(chosen).toBeTruthy();
    }
    await page.getByRole('button', { name: '행동 확정 · 턴 진행', exact: false }).click();
    await page.getByRole('button', { name: '턴 결과 바로 보기', exact: false }).click();
  }
  await expect(page.locator('.raid-result')).toContainText('1 스테이지 클리어');
  await expect(page.locator('.boss-health [role=progressbar]')).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: '다음 스테이지', exact: false }).click();
  await expect(page.locator('.raid-boss h2')).toHaveText('각시메뚜기');
  await expect(page.locator('.raid-turn-label')).toContainText('TURN 1');
  await expect(page.locator('.raid-route li.cleared')).toHaveCount(1);
  await expect(page.locator('.raid-ally').nth(0).getByRole('button', { name: '급소 사냥', exact: false })).toBeEnabled();
  await page.locator('.raid-guide summary').click();
  await expect(page.locator('.raid-guide')).toContainText('새로고침하면 처음부터');
});

test('natural playback follows speed order and changes HP without auto-starting the next turn', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => .99; });
  await selectTeam(page, ['넓적사슴벌레', '검정명주딱정벌레', '각시메뚜기']);
  for (const card of await page.locator('.raid-ally').all()) await card.getByRole('button', { name: '기본 공격', exact: false }).click();
  await page.getByRole('button', { name: '행동 확정 · 턴 진행', exact: false }).click();
  await expect(page.locator('.raid-current-action')).toContainText('각시메뚜기 · 기본 공격');
  await expect(page.locator('.raid-turn-label')).toContainText('TURN 2');
  await expect(page.getByRole('button', { name: '행동 확정 · 턴 진행', exact: false })).toBeDisabled();
  await page.locator('.raid-log summary').click();
  await expect(page.locator('.raid-log li').first()).toContainText('각시메뚜기');
  expect(await page.locator('.raid-log li').count()).toBe(4);
});

test('three knocked-out allies display game over and can restart with restored HP', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => { Math.random = () => .99; });
  const weak = [...catalog.insects].sort((a, b) => a.stats.hp - b.stats.hp).slice(0, 3);
  await selectTeam(page, weak.map(i => i.name));
  for (let turn = 0; turn < 70; turn++) {
    if (await page.locator('.raid-result.gameOver').count()) break;
    for (const card of await page.locator('.raid-ally:not(.is-down)').all()) {
      // Non-attacking support keeps the boss alive while allowing an actual wipe.
      await card.getByRole('button', { name: '방어', exact: false }).click();
    }
    await page.getByRole('button', { name: '행동 확정 · 턴 진행', exact: false }).click();
    await page.getByRole('button', { name: '턴 결과 바로 보기', exact: false }).click();
  }
  await expect(page.locator('.raid-result.gameOver')).toContainText('세 친구가 모두 쓰러졌어요');
  await expect(page.locator('.raid-ally.is-down')).toHaveCount(3);
  await page.getByRole('button', { name: '처음부터 다시 도전', exact: false }).click();
  await expect(page.locator('.raid-turn-label')).toContainText('TURN 1');
  await expect(page.locator('.raid-ally.is-down')).toHaveCount(0);
});
