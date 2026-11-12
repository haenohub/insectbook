import { test, expect } from '@playwright/test';
import catalog from '../data/web-catalog.json' with { type: 'json' };
const total = catalog.insects.length;
const counts = catalog.titleCounts;
const byId = Object.fromEntries(catalog.insects.map(i => [i.id, i]));
const errors = [];
test.beforeEach(async ({ page }) => { page.on('pageerror', e => errors.push(e.message)); });
test.afterEach(() => { expect(errors.splice(0)).toEqual([]); });

test('catalog loads real images, supports name, family, genus, feature filters, pagination and empty recovery', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.insect-card')).toHaveCount(12);
  await expect(page.locator('.results-toolbar p')).toContainText(String(total));
  const first = page.locator('.insect-card').first().locator('img');
  await expect(first).toBeVisible();
  await expect.poll(() => first.evaluate(img => img.complete && img.naturalWidth > 0)).toBeTruthy();
  const heroHeading = await page.locator('.hero h1').boundingBox();
  const heroCopy = await page.locator('.hero-copy').boundingBox();
  expect(Math.abs(heroHeading.x - heroCopy.x)).toBeLessThan(2);
  await page.getByRole('textbox', { name: '곤충 검색', exact: true }).fill('Indolestes');
  await expect(page.locator('.insect-card')).toHaveCount(1);
  await expect(page.locator('.card-name')).toHaveText('가는실잠자리');
  await page.getByRole('combobox', { name: '검색 범위' }).selectOption('family');
  await page.getByRole('textbox', { name: '곤충 검색', exact: true }).fill('흰나비과');
  await expect(page.locator('.insect-card')).toHaveCount(catalog.insects.filter(i => i.family === '흰나비과').length);
  await page.getByRole('textbox', { name: '곤충 검색', exact: true }).fill('없는곤충123xyz');
  await expect(page.getByText('아직 발견하지 못했어요.')).toBeVisible();
  await page.getByRole('button', { name: '검색 조건 초기화', exact: false }).click();
  await page.getByRole('button', { name: '비행의 대가', exact: false }).filter({ hasText: String(counts.flight) }).click();
  await expect(page.locator('.results-toolbar p')).toContainText(String(counts.flight));
  await page.getByRole('button', { name: '생존왕', exact: false }).filter({ hasText: String(counts.survivor) }).click();
  const both = catalog.insects.filter(i => ['flight', 'survivor'].every(t => i.traits.some(it => it.id === t))).length;
  await expect(page.locator('.results-toolbar p')).toContainText(String(both));
  await page.getByRole('button', { name: '모두 지우기', exact: true }).click();
  await page.getByRole('combobox', { name: '과 분류', exact: true }).selectOption('사슴벌레과');
  await expect(page.locator('.insect-card')).toHaveCount(catalog.insects.filter(i => i.family === '사슴벌레과').length);
  await page.getByRole('combobox', { name: '속 분류', exact: true }).selectOption(byId.ZOEC0014.genusLatin);
  await expect(page.locator('.insect-card')).toHaveCount(catalog.insects.filter(i => i.family === '사슴벌레과' && i.genusLatin === byId.ZOEC0014.genusLatin).length);
  await page.getByRole('button', { name: '모두 지우기', exact: true }).click();
  const firstName = await page.locator('.card-name').first().textContent();
  await page.getByRole('button', { name: '다음 페이지', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  expect(await page.locator('.card-name').first().textContent()).not.toEqual(firstName);
  await page.reload();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('.insect-card')).toHaveCount(12);
});

test('details display source notes, title evidence and game stats; favorites survive reload', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '노랑나비 상세 보기', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: '노랑나비', exact: true })).toBeVisible();
  await expect(dialog.locator('.source-sections')).toContainText('일반적으로 날개바탕색');
  await expect(dialog.getByRole('link', { name: '국립수목원 원문 도감 보기' })).toHaveAttribute('href', byId.ZRED0008.sourceUrl);
  await dialog.getByRole('tab', { name: '게임 능력치' }).click();
  await expect(dialog.getByText('곤충의 특징을 재해석한 게임용 수치예요.')).toBeVisible();
  await expect(dialog.locator('.stat-row')).toHaveCount(5);
  await dialog.locator('.evidence-list details').first().locator('summary').click();
  await expect(dialog.locator('.evidence-list details').first().locator('p')).toBeVisible();
  await dialog.getByRole('button', { name: '관찰함에 담기', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.locator('.site-header nav').getByRole('button', { name: '나의 관찰함', exact: false }).click();
  await expect(page.locator('.insect-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.card-name')).toHaveText('노랑나비');
  await page.getByRole('button', { name: '노랑나비 관찰함에서 빼기', exact: true }).click();
  await expect(page.getByText('첫 번째 친구를 담아볼까요?')).toBeVisible();
});

async function pickRaidTeam(page, names = ['넓적사슴벌레', '검정명주딱정벌레', '각시메뚜기']) {
  for (let n = 0; n < names.length; n++) {
    await page.getByRole('button', { name: `${n + 1}번 친구 고르기`, exact: false }).click();
    await page.getByRole('textbox', { name: '배틀 선수 검색' }).fill(names[n]);
    await page.getByRole('dialog').getByRole('button', { name: `${names[n]} 선택`, exact: true }).click();
  }
}

test('three slots reject duplicates and wait for all three choices before starting a manual round', async ({ page }) => {
  await page.goto('./?view=battle');
  await expect(page.getByRole('button', { name: '보스 도전 시작', exact: false })).toBeDisabled();
  await page.getByRole('button', { name: '1번 친구 고르기', exact: false }).click();
  await page.getByRole('textbox', { name: '배틀 선수 검색' }).fill('노랑나비');
  await page.getByRole('dialog').getByRole('button', { name: '노랑나비 선택', exact: true }).click();
  await page.getByRole('button', { name: '2번 친구 고르기', exact: false }).click();
  await page.getByRole('textbox', { name: '배틀 선수 검색' }).fill('노랑나비');
  await expect(page.getByRole('dialog').getByRole('button', { name: '노랑나비 선택', exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: '배틀 선수 검색' }).fill('넓적사슴벌레');
  await page.getByRole('dialog').getByRole('button', { name: '넓적사슴벌레 선택', exact: true }).click();
  await page.getByRole('button', { name: '3번 친구 고르기', exact: false }).click();
  await page.getByRole('textbox', { name: '배틀 선수 검색' }).fill('각시메뚜기');
  await page.getByRole('dialog').getByRole('button', { name: '각시메뚜기 선택', exact: true }).click();
  await page.getByRole('button', { name: '보스 도전 시작', exact: false }).click();
  const confirm = page.getByRole('button', { name: '행동 확정 · 턴 진행', exact: false });
  await expect(confirm).toBeDisabled();
  const allies = page.locator('.raid-ally');
  await allies.nth(0).getByRole('button', { name: '기본 공격', exact: false }).click();
  await allies.nth(1).getByRole('button', { name: '방어', exact: false }).click();
  await expect(confirm).toBeDisabled();
  await allies.nth(2).getByRole('button', { name: '도약 강타', exact: false }).click();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.locator('.raid-current-action')).toBeVisible();
  await expect(allies.nth(0).getByRole('button', { name: '기본 공격', exact: false })).toBeDisabled();
  await page.getByRole('button', { name: '턴 결과 바로 보기', exact: false }).click();
  await expect(page.locator('.raid-turn-label')).toContainText('TURN 2');
  await expect(page.locator('.raid-log')).toContainText('도약 강타');
  await expect(page.locator('.raid-log')).toContainText('방어');
  await expect(confirm).toBeDisabled();
  await expect(allies.nth(2).getByRole('button', { name: '도약 강타', exact: false })).toBeDisabled();
});

test('catalog allows three selections, a fourth is rejected, and the tray opens the boss expedition', async ({ page }) => {
  await page.goto('./');
  for (const name of ['노랑나비', '넓적사슴벌레']) await page.getByRole('button', { name: `${name} 배틀 선택`, exact: true }).click();
  await expect(page.getByRole('button', { name: '보스 도전하러 가기', exact: false })).toBeDisabled();
  const search = page.getByRole('textbox', { name: '곤충 검색', exact: true });
  await search.fill('각시메뚜기');
  await page.getByRole('button', { name: '각시메뚜기 배틀 선택', exact: true }).click();
  await search.fill('가는실잠자리');
  await page.getByRole('button', { name: '가는실잠자리 배틀 선택', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('세 친구');
  await expect(page.locator('.tray-label')).toContainText('3 / 3');
  await page.getByRole('button', { name: '보스 도전하러 가기', exact: false }).click();
  await expect(page.locator('.raid-ally h3')).toHaveText(['노랑나비', '넓적사슴벌레', '각시메뚜기']);
  await expect(page.locator('.raid-route li')).toHaveCount(10);
});

test('mobile filters, three ally cards and manual actions stay readable without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.getByRole('button', { name: '특징', exact: true }).click();
  await page.locator('.filters').getByRole('button', { name: '생존왕', exact: false }).click();
  await page.locator('.filters').getByRole('button', { name: '결과 보기', exact: false }).click();
  await expect(page.locator('.results-toolbar p')).toContainText(String(counts.survivor));
  await page.goto('./?view=battle');
  await pickRaidTeam(page);
  await page.getByRole('button', { name: '보스 도전 시작', exact: false }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    expect(await page.locator('.raid-action-grid button span').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(15);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const card of await page.locator('.raid-ally').all()) await card.getByRole('button', { name: '기본 공격', exact: false }).click();
  await page.getByRole('button', { name: '행동 확정 · 턴 진행', exact: false }).click();
  await page.getByRole('button', { name: '턴 결과 바로 보기', exact: false }).click();
  await expect(page.locator('.raid-turn-label')).toContainText('TURN 2');
  await page.screenshot({ path: '/tmp/insectbook-boss-raid-mobile.png', fullPage: true });
});

test('failed detail fetch can be retried without losing the dialog', async ({ page }) => {
  let attempts = 0;
  await page.route('**/data/insects/ZRED0008.json', route => { attempts++; return attempts === 1 ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.continue(); });
  await page.goto('./');
  await page.getByRole('button', { name: '노랑나비 상세 보기', exact: true }).click();
  await expect(page.getByText('관찰 기록을 불러오지 못했어요.')).toBeVisible();
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.locator('.source-sections')).toContainText('일반적으로 날개바탕색');
});
