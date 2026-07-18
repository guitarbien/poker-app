import { test, expect } from '@playwright/test';

test('訓練入口 → 底池賠率答一題 → 驗對錯與解說 → 下一題', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // 首頁 → 訓練
  await page.getByRole('button', { name: '訓練' }).click();

  // 訓練選單
  await expect(page.getByText('訓練模組')).toBeVisible();

  // 選底池賠率
  await page.getByTestId('start-potOdds').click();

  // 等待出題（選項出現）
  await expect(page.getByTestId('answer-btn-0')).toBeVisible({ timeout: 10_000 });

  // 點第一個選項
  await page.getByTestId('answer-btn-0').click();

  // 對錯 feedback 出現
  await expect(page.getByTestId('feedback-banner')).toBeVisible();

  // 解說出現
  await expect(page.getByTestId('explanation')).toBeVisible();

  // 下一題
  await page.getByTestId('next-question-btn').click();

  // 題目重置（feedback 消失）
  await expect(page.getByTestId('feedback-banner')).toBeHidden();
});

test('起手牌範圍答一題 → 13×13 矩陣渲染', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole('button', { name: '訓練' }).click();
  await page.getByTestId('start-preflopRange').click();

  // 等待出題
  await expect(page.getByTestId('answer-btn-open')).toBeVisible({ timeout: 10_000 });

  // 點任一選項觸發 feedback 與矩陣
  await page.getByTestId('answer-btn-open').click();

  // feedback 出現
  await expect(page.getByTestId('feedback-banner')).toBeVisible();

  // 13×13 矩陣：169 個 gridcell
  await expect(page.locator('[role="gridcell"]')).toHaveCount(169, { timeout: 5_000 });
});
