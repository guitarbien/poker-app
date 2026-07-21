import { test, expect } from '@playwright/test';

test('檢討流程：打一手 → 歷史 → 回放 → 儀表板', async ({ page }) => {
  // 清 localStorage 保證測試隔離
  await page.goto('/?fastCpu=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // 開桌
  await page.getByRole('button', { name: '開始牌局' }).click();
  await expect(page.getByTestId('seat')).toHaveCount(6);

  // 等輪到人類 → 棄牌
  await page.getByRole('button', { name: '棄牌' }).click({ timeout: 30_000 });

  // 等 handOver（「下一手」出現代表手牌已寫入 localStorage）
  await expect(page.getByTestId('next-hand-btn')).toBeVisible({ timeout: 45_000 });

  // 離開牌桌
  await page.getByTestId('exit-btn').click();

  // HomeScreen：進「檢討」
  await page.getByRole('button', { name: '檢討' }).click();

  // 歷史分頁：應有 1 列
  const historyRows = page.locator('text=/第 \\d+ 手/');
  await expect(historyRows).toHaveCount(1);

  // 點入回放 → 確認回放畫面載入
  // 有標記的手牌從標記步開始（stepIdx > 0），無標記從步驟 0 開始
  await historyRows.click();
  await expect(page.getByRole('button', { name: '← 返回' })).toBeVisible();

  // 點「下一步」→ 步驟前進（手牌開始文字消失或保持隱藏）
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByText('手牌開始')).toBeHidden();

  // 返回歷史列表
  await page.getByRole('button', { name: '← 返回' }).click();

  // 切換至儀表板
  await page.getByTestId('tab-dashboard').click();

  // 戰績手數 ≥ 1
  const handsText = await page.getByTestId('stat-hands').textContent();
  expect(Number(handsText)).toBeGreaterThanOrEqual(1);
});

test('弱點導練：儀表板「去練習」→ 進對應訓練 → 退出回檢討', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // 首頁 → 檢討 → 儀表板
  await page.getByRole('button', { name: '檢討' }).click();
  await page.getByTestId('tab-dashboard').click();

  // 點「翻牌前開牌過鬆」的去練習 → 應導向起手牌範圍訓練
  await page.getByTestId('weak-preflop-loose').getByRole('button', { name: '去練習' }).click();

  // 進入起手牌範圍訓練（quiz 出題，answer-btn-open 為 preflopRange 專有）
  await expect(page.getByTestId('answer-btn-open')).toBeVisible({ timeout: 10_000 });

  // 退出 → 回檢討（儀表板 tab 仍在），而非回首頁
  await page.getByRole('button', { name: '退出' }).click();
  await expect(page.getByTestId('tab-dashboard')).toBeVisible();
});
