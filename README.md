# 德州撲克練習

單人德州撲克（No-Limit Texas Hold'em）練習網站：與可選難度的 CPU 對戰、每手牌自動檢討標記、弱點統計，以及四個獨立訓練模組。純前端 SPA + PWA，完全離線可玩，資料存於 localStorage。

## 功能

- **對戰**：2–6 人現金桌（盲注 1/2、2/5、5/10），CPU 三種難度（簡單查表／普通開牌表＋賠率／困難勝率驅動含半詐唬），練習輔助顯示（即時勝率、底池賠率、目前成牌，可開關）
- **檢討**：手牌歷史與逐步回放、決策自動標記（翻牌前 RFI 過鬆/過緊、賠率不足跟注）、弱點儀表板（VPIP/PFR/攤牌勝率與弱點比率），弱點直達對應訓練
- **訓練**：牌型判讀、底池賠率、起手牌範圍（13×13 對照表）、Equity 估算（±5% 判定）；錯題本連續答對兩次移出
- **PWA**：離線可玩、可安裝至主畫面

## 開發

```bash
npm install
npm run dev          # 開發伺服器
npm run typecheck    # tsc -b
npm run test         # Vitest 單元測試
npm run coverage     # 覆蓋率（門檻 85%）
npm run test:e2e     # Playwright（desktop / mobile / offline）
npm run build        # tsc -b && vite build（含 PWA）
npm run lint         # oxlint
```

## 架構

```
src/
├── engine/     # 純 TS 撲克引擎：牌局狀態機、7 取 5 評分、Monte Carlo 勝率、RFI 表
├── cpu/        # CPU 決策（三難度，純函式、rng 注入）
├── trainers/   # 訓練模組出題/判定 + 錯題本（純函式）
├── review/     # 手牌記錄、回放重建、決策評分
├── stats/      # 戰績 counters
├── storage/    # 版本化 localStorage 封裝
└── features/   # React UI（table / review / trainers / home）
```

核心原則：engine 是純函式狀態機（`applyAction(state, action) → newState`），UI、CPU、檢討、訓練都只是它的消費者；隨機性一律注入 `rng`，測試可重現。

設計文件：`docs/superpowers/specs/`；各里程碑實作計畫：`docs/superpowers/plans/`。
