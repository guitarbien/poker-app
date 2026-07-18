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

test('錯題複習流程：答錯收入 → 徽章驗證 → 連對兩次 → 複習完成', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // 進入底池賠率練習
  await page.getByRole('button', { name: '訓練' }).click();
  await page.getByTestId('start-potOdds').click();

  // 等題目出現，點答錯的選項
  await expect(page.getByTestId('answer-btn-0')).toBeVisible({ timeout: 10_000 });
  await page.locator('button[data-correct="false"]').first().click();

  // 等 feedback 後退出到選單
  await expect(page.getByTestId('feedback-banner')).toBeVisible();
  await page.getByRole('button', { name: '退出' }).click();

  // 選單：驗錯題徽章與複習按鈕
  await expect(page.getByTestId('wrong-badge-potOdds')).toHaveText('錯題 1 題');
  await expect(page.getByTestId('review-potOdds')).toBeEnabled();

  // 進入複習模式
  await page.getByTestId('review-potOdds').click();

  // 第一次答對
  await expect(page.locator('button[data-correct="true"]').first()).toBeVisible({ timeout: 10_000 });
  await page.locator('button[data-correct="true"]').first().click();
  await expect(page.getByTestId('next-question-btn')).toBeVisible();
  await page.getByTestId('next-question-btn').click();

  // 第二次答對（同一題 FIFO 再出現）
  await expect(page.locator('button[data-correct="true"]').first()).toBeVisible({ timeout: 10_000 });
  await page.locator('button[data-correct="true"]').first().click();
  await expect(page.getByTestId('next-question-btn')).toBeVisible();
  await page.getByTestId('next-question-btn').click();

  // 複習完成畫面
  await expect(page.getByText('複習完成')).toBeVisible({ timeout: 5_000 });
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
