import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGE_ERROR', e.message));
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  for (let y = 0; y < await page.evaluate(() => document.body.scrollHeight); y += 700) { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(120); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.insect-grid img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode().catch(() => null))));
  await page.screenshot({ path: 'artifacts/catalog-desktop.png', fullPage: true });
  await page.screenshot({ path: 'artifacts/catalog-desktop-top.png' });
  console.log('TITLE', await page.title());
  console.log('CARDS', await page.locator('.insect-card').count());
  console.log('OVERFLOW', await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth })));
  await page.getByRole('button', { name: '곤충 배틀', exact: false }).first().click();
  await page.screenshot({ path: '/tmp/insectbook-arena-empty.png', fullPage: true });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  for (let y = 0; y < await mobile.evaluate(() => document.body.scrollHeight); y += 700) { await mobile.evaluate(y => window.scrollTo(0, y), y); await mobile.waitForTimeout(120); }
  await mobile.evaluate(() => window.scrollTo(0, 0));
  await mobile.locator('.insect-grid img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode().catch(() => null))));
  await mobile.screenshot({ path: 'artifacts/catalog-mobile.png', fullPage: true });
  console.log('MOBILE_OVERFLOW', await mobile.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth })));
} finally { await browser.close(); }
