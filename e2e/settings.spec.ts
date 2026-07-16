import { test, expect } from '@playwright/test';

test('改 CPU 數為 2 → 開桌後 seat 數為 3（含人類）', async ({ page }) => {
  await page.goto('/?fastCpu=1');

  // 點 CPU 數量「2」（exact 避免 1/2、2/5 盲注按鈕干擾）
  await page.getByRole('button', { name: '2', exact: true }).click();

  // 開桌
  await page.getByRole('button', { name: '開始牌局' }).click();

  // 2 CPU + 1 human = 3 seats
  await expect(page.getByTestId('seat')).toHaveCount(3);
});

test('開關練習輔助 → AssistPanel 顯示/消失', async ({ page }) => {
  await page.goto('/?fastCpu=1');
  await page.getByRole('button', { name: '開始牌局' }).click();

  // 預設 assistEnabled: true → body 可見
  const panel = page.getByTestId('assist-panel');
  await expect(panel).toBeVisible();

  // 關閉輔助
  await page.getByRole('button', { name: '關閉輔助' }).click();
  // body 消失（panel 本身仍在 DOM，但 body 不渲染）
  await expect(page.getByRole('button', { name: '開啟輔助' })).toBeVisible();
  await expect(page.getByTestId('assist-equity')).toBeHidden();

  // 重新開啟
  await page.getByRole('button', { name: '開啟輔助' }).click();
  await expect(page.getByRole('button', { name: '關閉輔助' })).toBeVisible();
});
