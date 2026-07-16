import { test, expect } from '@playwright/test';

test('離線後仍可開桌打牌', async ({ page, context }) => {
  // 首次載入，等頁面穩定
  await page.goto('/?fastCpu=1');
  await page.waitForLoadState('load');

  // 等 SW ready（vite-plugin-pwa 預設 generateSW + clientsClaim:true）
  await page.evaluate(() => navigator.serviceWorker.ready);

  // 若 controller 還是 null（首次安裝，SW 尚未 claim），reload 一次
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  if (!controlled) {
    await page.reload();
    await page.waitForLoadState('load');
    await page.evaluate(() => navigator.serviceWorker.ready);
  }

  // 確認 SW 已接管
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10_000 });

  // 離線
  await context.setOffline(true);

  // reload 後測試離線可用（app shell 從 SW 快取載回）
  await page.reload();

  await expect(page.getByRole('button', { name: '開始牌局' })).toBeVisible({ timeout: 20_000 });

  // 開桌確認 6 個座位渲染
  await page.getByRole('button', { name: '開始牌局' }).click();
  await expect(page.getByTestId('seat')).toHaveCount(6);
});
