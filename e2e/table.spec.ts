import { test, expect } from '@playwright/test';

test('開桌並打完一手牌（人類棄牌）', async ({ page }) => {
  await page.goto('/?fastCpu=1'); // 縮短 CPU 延遲，避免等待逼近 timeout
  await page.getByRole('button', { name: '開始牌局' }).click();
  // 6 個座位都渲染
  await expect(page.getByTestId('seat')).toHaveCount(6);
  // 等到輪到人類（棄牌鈕可點）
  const fold = page.getByRole('button', { name: '棄牌' });
  await fold.click({ timeout: 30_000 });
  // CPU 打完後出現結果橫幅與下一手
  const next = page.getByRole('button', { name: /下一手|重買/ });
  await next.click({ timeout: 45_000 });
  // 新的一手開始：結果橫幅消失
  await expect(page.getByRole('button', { name: '下一手' })).toBeHidden();
});

test('頁面無橫向捲動', async ({ page }) => {
  await page.goto('/?fastCpu=1');
  await page.getByRole('button', { name: '開始牌局' }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
