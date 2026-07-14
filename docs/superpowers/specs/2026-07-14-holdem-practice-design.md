# 德州撲克練習網站 — 設計文件

日期：2026-07-14
狀態：已與需求方逐段確認核心設計，並經多視角 spec 審查修訂，待實作規劃

## 1. 目標與定位

一個 RWD 網頁版德州撲克（No-Limit Texas Hold'em）**練習**網站：

- 與傳統單機遊戲相同的體驗：離線可玩、CPU 對手可選難度
- 與一般撲克遊戲的差異：以「學習與成長」為核心 —— 對戰時可開啟輔助資訊、每手牌自動檢討、弱點統計、獨立訓練模組
- 單人使用，無多人連線、無真錢、無帳號系統

### 已確認的產品決策

| 決策點 | 結論 |
|---|---|
| 產品形態 | 對戰 + 獨立訓練模組 |
| 牌桌形式 | 6 人桌（玩家 + 1–5 個 CPU，開局時決定，session 中成員固定） |
| 遊戲形式 | 現金桌（固定盲注、手與手之間可重買） |
| CPU 對手 | 傳統單機式、可選難度等級（簡單/普通/困難） |
| 架構 | 純前端 SPA、完全離線可玩、無後端 |
| 技術選型 | Vite + React + TypeScript + PWA |
| 資料保存 | localStorage |
| 介面語言 | 繁體中文 |

### 遊戲參數（預設值）

- 盲注等級：**1/2（預設）**、2/5、5/10，開局時選定，session 中固定
- 起始買入：**100 BB**（1/2 桌即 200 籌碼），所有玩家（含 CPU）相同
- 重買上限：補至起始買入（不可超買）

## 2. 技術選型

- **Vite + React 18 + TypeScript**：牌桌是「狀態 → 畫面」的高頻映射，declarative UI 最合適；React 生態最大
- **vite-plugin-pwa**：service worker 以 precache 快取全部建置產物（HTML/JS/CSS/圖示），達成離線遊玩與「安裝到主畫面」
- **不用 React Router**：僅四個頂層畫面且無 deep-link 需求，`App.tsx` 用單一 `screen` state 切換
- **不引入狀態管理庫**：牌局狀態集中在 engine 的單一 state 物件，React 端用 `useReducer` 即可
- **不引入 UI 元件庫**：牌桌是完全客製的畫面；CSS 用原生 + CSS Modules
- **不用 Web Worker**：2,000 次 Monte Carlo 模擬在現代裝置為毫秒級，`equity()` 直接同步呼叫。若在低階裝置實測卡 UI，再把 equity 搬進 Worker（明確的後續升級路徑，第一版不做）
- **牌型評分自行實作**：7 取 5 最佳牌型的 evaluator 是訓練模組與檢討機制的共用核心，且演算法定義明確、適合完整單元測試

## 3. 整體架構

```
src/
├── engine/            # 純 TS 撲克引擎（零 UI 依賴、零副作用）
│   ├── deck.ts        #   牌的編碼、洗牌、發牌、cardToString/parseCard
│   ├── evaluator.ts   #   7 張取最佳 5 張的牌型評分與比較
│   ├── game.ts        #   牌局狀態機（下注圈、合法動作、彩池/邊池、攤牌、rebuy）
│   ├── equity.ts      #   Monte Carlo 勝率模擬（同步函式）
│   └── ranges.ts      #   6-max RFI 起手牌表（附錄 A）與 Range 型別
├── cpu/
│   └── strategy.ts    # CPU 決策：(GameState, seat, 難度, rng) → Action
├── review/
│   ├── recorder.ts    # 手牌歷史記錄（HandRecord 組裝與寫入）
│   └── grader.ts      # 決策評分（對照 ranges.ts / 賠率 vs 勝率）
├── trainers/          # 四個訓練模組（出題、判定、解說）
│   ├── handReading.ts
│   ├── potOdds.ts
│   ├── preflopRange.ts
│   └── equityGuess.ts
├── storage/
│   └── storage.ts     # localStorage 讀寫（含 schema 版本欄位）
├── features/          # React UI
│   ├── table/         #   對戰牌桌
│   ├── trainers/      #   訓練模組畫面
│   ├── review/        #   手牌歷史、回放、弱點儀表板
│   └── home/          #   首頁選單
└── App.tsx            # 畫面切換：screen = 'home' | 'table' | 'trainer' | 'review'
```

**核心原則：engine 是純函式狀態機。** `applyAction(state, action) → newState | Error`。UI、CPU、檢討機制都只是這個狀態機的消費者。牌局邏輯（比牌、邊池、下注圈結束條件）可以不碰瀏覽器完整單元測試；訓練模組與檢討機制直接重用 evaluator、equity 與 ranges，不寫第二份。起手牌表放在 engine 內是因為 cpu/、review/、trainers/ 三方共用，避免反向依賴。

## 4. 核心資料結構

### 牌的編碼

```ts
type Card = number;  // 0–51
// rank = Math.floor(card / 4)：0 = '2', 1 = '3', … 8 = 'T', 9 = 'J', 10 = 'Q', 11 = 'K', 12 = 'A'
// suit = card % 4：0 = 'c'（梅花）, 1 = 'd'（方塊）, 2 = 'h'（紅心）, 3 = 's'（黑桃）
// deck.ts 提供 cardToString(51) === 'As' 與 parseCard('As') === 51，為全專案唯一的轉換點
```

### 牌局狀態

```ts
interface Player {
  seat: number;            // 0–5，0 固定為人類玩家
  stack: number;           // 目前籌碼
  hole: [Card, Card] | null;
  state: 'active' | 'folded' | 'allin';  // 每手開始時重置為 active
  committed: number;       // 本下注圈已投入
  totalCommitted: number;  // 本手牌累計投入（邊池計算用）
  actedThisRound: boolean; // 本圈是否已行動（換街時與「完整加注」發生時重置；不足額 all-in 不重置）
  isCpu: boolean;
  difficulty?: 'easy' | 'normal' | 'hard';
}

interface GameState {
  players: Player[];
  button: number;          // 莊家位 seat
  street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'handOver';
  board: Card[];           // 0–5 張
  deck: Card[];
  pots: { amount: number; eligible: number[] }[];  // 主池 + 邊池；結算時填入，牌局進行中為空（UI 彩池顯示以 Σ totalCommitted 推導）
  toAct: number | null;    // 輪到誰行動
  currentBet: number;      // 本圈目前最高注
  minRaise: number;        // 下一次合法加注的最小「增量」，以最後一次完整 bet/raise 的增量為準
  blinds: { sb: number; bb: number };
  handNumber: number;
  result: PotResult[] | null;    // handOver 時由 engine 填入，其餘時間為 null
}

interface PotResult {
  potIndex: number;
  winners: { seat: number; amount: number; handRank: number | null }[];
  // handRank 為 evaluator 評分；未攤牌收池（其他人全棄牌）時為 null
}

type Action =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; to: number };   // raise to 總額（含 bet）

// rebuy 不是下注動作，是獨立 API：
// rebuy(state, seat, amount) → newState
// 僅允許在 street === 'handOver' 時呼叫；重買後 stack 不得超過起始買入
```

牌型評分回傳單一整數（類別 + kicker 編碼），兩手比大小 = 比整數，**沒有特殊情況**。

### 範圍（Range）的表示

```ts
type HandClass = string;        // 169 個 canonical 類別：'AA', 'AKs', 'AKo', … '22'
type Range = Set<HandClass>;    // 第一版不含權重
// equity.ts（vs 範圍模擬）、trainers/preflopRange、trainers/equityGuess 共用此型別
```

### 手牌歷史與檢討標記

```ts
interface HandRecord {
  version: number;
  handNumber: number;
  timestamp: number;
  blinds: { sb: number; bb: number };
  button: number;
  players: { seat: number; stack: number; hole: [Card, Card]; isCpu: boolean }[];
  // 記錄「所有」玩家底牌（含蓋牌的 CPU）；回放 UI 預設隱藏未攤牌的 CPU 底牌，提供「顯示所有底牌」開關
  actions: { seat: number; street: string; action: Action; potAfter: number }[];
  board: Card[];
  potResults: PotResult[];
  flags: ReviewFlag[];   // 決策評分結果，評分完成後寫入
}
// 回放 = 以初始狀態依序重放 actions（重用 engine 的 applyAction）；跳至某街 = 重放至該街第一個動作

interface ReviewFlag {
  actionIndex: number;   // 指向 actions[] 的索引，供「點入跳至該決策點」
  kind: 'preflop-loose' | 'preflop-tight' | 'call-without-odds';
  detail?: { requiredEquity?: number; estimatedEquity?: number };
}
```

### localStorage schema（皆含 `version` 欄位以利未來遷移）

| key | 內容 |
|---|---|
| `holdem.settings` | 盲注等級、CPU 數量與各自難度、輔助資訊開關 |
| `holdem.stats` | **原始計數器**（見下），比率一律由 UI 即時推導 |
| `holdem.hands` | `HandRecord[]`，環形緩衝上限 500 手，超過淘汰最舊（含其 flags 明細） |
| `holdem.reviewFlags` | 彙總：`{ [kind]: { count, opportunities } }`，分子分母都累計、永久保留（不隨手牌淘汰） |
| `holdem.trainer.<模組名>` | 各模組答題統計與錯題本 |

`holdem.stats` 計數器與定義：

- `handsPlayed`：發到牌的總手數
- `totalWinnings`：Σ(每手分得彩池 − 每手投入)，即累計淨損益（跨重買累計）
- `vpipHands`：翻牌前**主動**投入籌碼的手數（跟注/加注；貼盲注與 BB 免費看牌不計）
- `pfrHands`：翻牌前加注過的手數
- `showdownsSeen`：玩家未棄牌且進入攤牌的手數
- `showdownsWon`：攤牌且分得彩池的手數

UI 顯示：VPIP = vpipHands / handsPlayed；PFR = pfrHands / handsPlayed；攤牌勝率 = showdownsWon / showdownsSeen。

## 5. 撲克引擎（engine/）

範圍：標準 No-Limit Texas Hold'em 現金桌規則。

### 位置與行動順序

- **3 人以上**：preflop 從 BB 後一位開始；postflop 從 button 後第一個仍可行動（非棄牌且非 all-in）者開始
- **Heads-up（桌上僅 2 人，含開局就只開 1 個 CPU 的情況）**：button 兼任 SB；preflop 由 button/SB 先行動，postflop 由 BB 先行動
- **位置名稱指派（2–6 人桌通用）**：button 順時針依序為 SB、BB；其餘座位從 BTN 逆時針回推依序指派 CO → MP → UTG（先滿足後位）。例：4 人桌 = CO/BTN/SB/BB、5 人桌 = MP/CO/BTN/SB/BB。CPU 開牌與 RFI 評分依此名稱查附錄 A
- **button 移動**：每手結束後順時針移至下一個座位。因 CPU 自動重買（見 §6）且人類重買或離桌，session 中桌上成員固定，不需要 dead button 規則

### 下注圈

- check/call/raise 合法性由 engine 判定；`minRaise` 為最後一次**完整** bet/raise 的增量
- **bet 的表示**：Action union 不另設 bet 型別——`currentBet === 0` 時的 `raise to X` 即為下注；每街開始 `minRaise` 初始化為 1 BB（preflop 的 BB 盲注視為初始 bet，`currentBet = BB`、`minRaise = BB`），故最小下注為 1 BB、preflop 最小加注到 2 BB
- **不足額 all-in（all-in 金額低於一個完整加注增量）**：
  - 對「本圈已行動過」的玩家**不重開行動**——他們只能 call 或 fold
  - 尚未行動的玩家不受影響，仍保有完整加注權利
  - `minRaise` 不更新，仍以最後一次完整加注的增量為準
  - 實作上：完整加注發生時重置所有其他玩家的 `actedThisRound = false`；不足額 all-in 不重置
- **下注圈結束條件**：所有未棄牌且未 all-in 的玩家 `committed === currentBet` 且 `actedThisRound === true`。此定義自然涵蓋「preflop 全員跟注時 BB 仍有 option」（BB 尚未行動）與「postflop 全員 check」
- **全員 all-in run-out**：若未棄牌玩家中可行動者（非 all-in）不足兩人且注額已補齊，跳過剩餘下注圈、連續發完剩餘公共牌直接進入攤牌

### 彩池與攤牌

- 以各玩家 `totalCommitted` 排序切層計算主池與邊池，攤牌時逐池比牌分配
- **未被跟注的超額下注退還原下注者**（唯一有資格者的最上層彩池即為退還額）
- **死錢歸池**：棄牌玩家投入超過最高全下分層的部分（死錢）歸入最高邊池，確保籌碼守恆
- 平手均分；除不盡的餘數籌碼給最接近 button 左側（順時針第一位）的贏家
- 只剩一人未棄牌 → 直接收池不攤牌（`PotResult.handRank = null`），不經過 showdown、直接進 handOver
- **`'showdown'` 為 engine 內部瞬時階段**：下注圈結束進入 showdown 時，engine 立即比牌、分池、填入 `GameState.result` 並自動轉入 `handOver`；UI 不會停留在 showdown 街道
- 攤牌結果寫入 `GameState.result`，UI 與 recorder 直接讀取，不自行重算

### evaluator 與 equity

- **evaluator**：7 張取 5 的最佳牌型，涵蓋全部牌型含輪子順（A-2-3-4-5）與同花輪子順
- **equity.ts**：給定我方手牌、公共牌、對手數量（或對手 Range），Monte Carlo 模擬 N 次（預設 2,000 次，誤差約 ±1%）回傳勝率。同步函式，毫秒級。簽名須可注入 rng（`equity(hand, board, opponents, n, rng)`），單元測試以固定 seed 取得可重現結果。供對戰輔助顯示、困難 CPU、檢討評分、Equity 訓練模組四方共用

非法動作（不夠籌碼、金額低於最小加注、面對下注過牌、時機不對的 rebuy）回傳明確的 typed error 而非壞掉的狀態。「輪到誰行動」由 `toAct` 欄位驅動——呼叫端依 `toAct` 派發動作、UI 只渲染合法按鈕，形成雙層防護。

## 6. CPU 決策（cpu/）

三個難度共用同一決策管線：**手牌強度 → 決策表 → 隨機擾動**，差別在資訊量與精細度：

| 難度 | 使用資訊 | 行為特徵 |
|---|---|---|
| 簡單 | 只看自己牌型強度（查表） | 不看位置與賠率，動作帶較大隨機性，常見漏洞明顯 |
| 普通 | 強度 + 位置 + 底池賠率 | 依 ranges.ts 開牌、會基本價值下注與棄牌 |
| 困難 | 快速 equity 估算（500 次模擬）+ 賠率 + 位置 | 會半詐唬（依聽牌 equity）、會控池、下注尺寸有變化 |

- 開局設定可個別指定每個 CPU 的難度，或一鍵套用相同難度
- **CPU 破產：籌碼歸零後於下一手開始前自動重買至起始買入**（呼叫 engine 的 rebuy API），桌子永遠滿員
- CPU 行動加入 0.5–1.5 秒隨機延遲，模擬思考節奏（延遲在 UI 層，engine 不管時間）
- CPU 決策是純函式 `(GameState, seat, difficulty, rng) → Action`，注入 rng 以便測試可重現

明確的取捨：CPU 不做對手建模、不記牌、不追求 GTO。目標是「行為合理、難度有感、離線可跑」，不是不可擊敗。

## 7. 對戰牌桌 UI（features/table/）

### 版面（RWD）

- **桌機/橫向**：橢圓牌桌，6 座位環繞，公共牌與彩池置中
- **手機直向**：對手壓縮為頭像 + 籌碼 + 狀態的橫列置於上方；公共牌與彩池置中；玩家手牌與操作區固定在底部。以 CSS media query 切換版面，不做兩套元件
- 目標支援：iOS Safari / Android Chrome / 桌面現代瀏覽器

### 操作列

- 棄牌 / 過牌 / 跟注（顯示金額）/ 加注
- 加注：滑桿 + 快捷鍵（1/2 池、2/3 池、滿池、All-in）+ 直接輸入
- 只顯示當下合法的動作按鈕

### 練習輔助（可整體開關，預設開）

- 我方即時勝率：vs「隨機手牌」假設（UI 標明此假設）；對手數取當下 state 為 active/allin 的對手數；**每街發牌後與每次有對手棄牌後重算**，下注動作不觸發重算
- 底池賠率與所需勝率（每次輪到玩家行動時顯示）
- 目前成牌名稱（如「兩對：K 和 7」）

### 牌局流程

- 每手結束：顯示攤牌結果（讀 `GameState.result`）、贏家牌型、彩池分配動畫，數秒後（或點擊後）進下一手
- 手與手之間（handOver 期間）：若玩家 stack 低於起始買入，操作區顯示「補碼」按鈕（補至起始買入）
- 人類籌碼輸光：跳出對話框——「重買（補至起始買入）」或「離開牌桌」
- 每手結束即寫入戰績（`holdem.stats`）與手牌記錄（`holdem.hands`，由 review/recorder.ts 負責，**屬 M3 交付**）

## 8. 訓練模組（trainers/）

四個模組共用「出題 → 作答 → 即時對錯 + 解說 → 下一題」的測驗迴圈與答題統計元件。

1. **牌型判讀**：隨機發 7 張，四選一選出最佳牌型；進階題型：兩手牌比大小。判定用 engine 的 evaluator，解說顯示組成牌型的 5 張牌
2. **底池賠率**：隨機生成池底/跟注額情境，作答形式為**四選一**，選項為「所需勝率」的百分比區間；解說附完整計算式（跟注額 ÷ (池底 + 跟注額)）
3. **起手牌範圍**：給定位置與起手牌，回答「開牌 / 棄牌」；判定依 `engine/ranges.ts`（附錄 A），解說顯示 13×13 範圍矩陣並標記該手牌位置。**題目僅涵蓋無人進池的 RFI 情境**
4. **Equity 估算**：顯示我方手牌 + 對手範圍（或明牌）+ 街道，玩家輸入估計勝率，Monte Carlo 驗證。計分：誤差 ≤5% 算答對；答對與否只計入該模組正確率統計，無另外的分數系統

### 共用機制

- **錯題本**：答錯的題目自動收入；各模組內提供「複習錯題」入口，僅從錯題本抽題；同一題**連續**答對兩次（任何模式下，中間答錯歸零）即移出
- 各模組累計出題數/答對數寫入 `holdem.trainer.<模組名>`

## 9. 檢討機制（review/）

核心思路：**重用 engine 當裁判** —— `ranges.ts` 與 `equity()` 既有，檢討即為決策與基準的對照。

### a. 手牌歷史與回放

- 每手牌以 `HandRecord`（§4）記錄，含所有玩家底牌
- 回放檢視器：逐動作重播（重用 `applyAction`）、可跳至任一街；預設隱藏未攤牌的 CPU 底牌，提供「顯示所有底牌」開關

### b. 決策標記（每手結束後自動執行，同步計算即可，毫秒級）

- **翻牌前（僅評 RFI 情境）**：玩家在「輪到自己時前面無人加注」的開牌/棄牌決策，對照 `ranges.ts` → 標記「標準 / 過鬆（preflop-loose）/ 過緊（preflop-tight）」。**面對加注、盲注防守等情境第一版不評分**（開牌表不適用，硬套會產生錯誤教學；見 §12）
- **翻牌後跟注**：以當下可見資訊（自己手牌 + 公共牌 + 對手數）計算勝率 vs 底池賠率 → 賠率不足的跟注標記為 `call-without-odds`，`detail` 附 `requiredEquity` 與 `estimatedEquity`（例：「此跟注需要 25% 勝率，估計勝率僅 18%」）
- 標記寫入該手 `HandRecord.flags`，同時累加 `holdem.reviewFlags` 的分子（count）與分母（opportunities，如「RFI 決策總數」「翻牌後跟注總數」）
- 有標記的手牌在歷史列表高亮，點入依 `flag.actionIndex` 直接跳至該決策點

### c. 弱點儀表板

- 讀 `holdem.reviewFlags` 彙總顯示比率：「翻牌前開牌過鬆：32%（21/66 次 RFI 決策）」等，母數定義直接顯示在文案中
- 每類弱點附「去練習」連結，導向對應訓練模組
- 明細（個別手牌）隨 500 手環形緩衝淘汰，彙總永久累計——此取捨為刻意設計

### d. 錯題本

- 見訓練模組共用機制（§8）

**明確的邊界**：評分基準是數學上可判定的部分（RFI 開牌表、賠率 vs 勝率）。下注/加注的品質（詐唬時機、尺寸）不評分；翻牌後勝率採「vs 隨機手牌」假設並於解說中標明，未做對手範圍推估。

## 10. 錯誤處理

- **engine**：非法動作回傳 typed error；狀態機不可能進入非法狀態（單元測試保證）
- **localStorage**：讀取失敗或 schema 版本不符 → 以預設值重建並提示使用者；寫入失敗（容量滿）→ 淘汰最舊手牌歷史後重試
- **UI 對 engine 錯誤的處理**：理論上不會發生（按鈕已過濾），若發生則記 console 並忽略該動作，牌局不中斷

## 11. 測試策略

### 開發流程約束（全里程碑適用）

- **TDD**：所有開發以「先寫失敗測試 → 最小實作 → 通過 → commit」循環進行
- **覆蓋率**：以 85% 為目標，vitest coverage thresholds（lines/branches/functions/statements ≥ 85）寫進設定強制執行
- **SOLID**：模組單一職責（每檔一個明確責任）、engine 為純函式無副作用、隨機性一律以 rng 注入（依賴反轉）、以 exported types 定義模組邊界

### 測試內容

- **單元測試（Vitest）集中在 engine**：
  - evaluator：各牌型判定、邊界（輪子順、同花對決 kicker、公共牌成牌）、兩手比較
  - game：下注圈結束條件（含 BB option、全員 check）、最小加注、**不足額 all-in 不重開行動與 minRaise 不變**、**heads-up 盲注配置與行動順序**、**全員 all-in run-out**、邊池分配（含三層邊池、平手分池、**未跟注退還**）、rebuy 時機與上限
  - equity：固定 seed 下，已知情境的勝率落在理論值 ±2% 內（rng 可注入，測試可重現）
- **cpu / review / trainers**：純函式，對代表性情境做單元測試（grader 需涵蓋：RFI 標記正確、非 RFI 情境不標記、賠率不足跟注標記）
- **UI 煙霧測試（Playwright）**：開一手牌從發牌打到攤牌、開關輔助資訊、進入訓練模組答一題、檢視手牌歷史
- 測試優先序：engine 全覆蓋 > 檢討評分正確性 > UI 流程

## 12. 非目標（第一版不做）

- 多人連線對戰、帳號系統、雲端同步
- 錦標賽（SNG）模式 —— 留待第二階段
- GTO solver 整合、對手建模
- **翻牌前「面對加注」情境的決策評分**（需 facing-raise 範圍表，留待後續）
- 帶權重的範圍（Range 第一版為純集合）
- equity 計算搬 Web Worker（實測低階裝置卡頓才做）
- 多語系（僅繁體中文）
- 音效與華麗動畫（保留基本的發牌/收池過渡即可）

## 13. 里程碑切分（供實作規劃參考）

1. **M1 引擎**：deck / evaluator / game / equity / ranges + 完整單元測試（純 TS，無 UI）
2. **M2 最小牌桌**：6 人桌 UI、簡單難度 CPU、能完整打一手牌、RWD 版面
3. **M3 完整對戰**：三種難度、練習輔助顯示、重買、戰績、**手牌記錄（recorder）**、PWA 離線
4. **M4 檢討**：回放檢視器、決策標記（grader）、弱點儀表板
5. **M5 訓練模組**：四個模組 + 錯題本

每個里程碑結束時皆為可執行、可展示的狀態。**實作計畫依里程碑拆成 5 份**，每份以該里程碑的可展示狀態為驗收條件。

## 附錄 A：6-max RFI 開牌表（engine/ranges.ts 的內容基準）

無人進池時的開牌（raise first in）範圍。此表同時是：普通/困難 CPU 的開牌基準、訓練模組 3 的答案、檢討機制翻牌前評分的基準。範圍字串採標準記法（`77+` = 77 到 AA；`ATs+` = ATs 到 AKs；`s` = 同花、`o` = 不同花）。

| 位置 | 範圍 | 約占比（/1326 組合） |
|---|---|---|
| UTG | 77+, ATs+, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo | ~11% |
| MP | 66+, A9s+, KTs+, QTs+, J9s+, T9s, 98s, 87s, ATo+, KJo+ | ~14% |
| CO | 44+, A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, ATo+, KTo+, QJo | ~20% |
| BTN | 22+, A2s+, K5s+, Q7s+, J8s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, A5o+, K9o+, Q9o+, J9o+, T9o | ~35% |
| SB | 22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, A8o+, KTo+, QTo+, JTo | ~26% |

- BB 無 RFI 情境（無人進池時 BB 直接看免費翻牌不成立——SB limp 情境第一版不評分）
- Heads-up 時 button/SB 的開牌範圍採 BTN 表
- 此表為「合理的標準參考範圍」，非唯一正解；實作時以此表寫死，後續調整表內容不影響架構
