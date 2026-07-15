import type { Card } from './deck';
import type { Position } from './ranges';

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'handOver';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Player {
  seat: number;
  stack: number;
  hole: [Card, Card] | null;
  state: 'active' | 'folded' | 'allin';
  committed: number;
  totalCommitted: number;
  actedThisRound: boolean;
  isCpu: boolean;
  difficulty?: Difficulty;
}

export interface PotResult {
  potIndex: number;
  winners: { seat: number; amount: number; handRank: number | null }[];
}

export interface GameState {
  players: Player[];
  button: number;
  street: Street;
  board: Card[];
  deck: Card[];
  pots: { amount: number; eligible: number[] }[];
  toAct: number | null;
  currentBet: number;
  minRaise: number;
  blinds: { sb: number; bb: number };
  handNumber: number;
  result: PotResult[] | null;
}

export type Action =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; to: number };

// 「輪不到你」不設 error code：行動者由 toAct 隱含指定，呼叫端依 toAct 派發動作（spec §10 雙層防護）
export type EngineErrorCode = 'ILLEGAL_ACTION' | 'BELOW_MIN_RAISE' | 'BAD_AMOUNT' | 'BAD_TIMING';

export class EngineError extends Error {
  constructor(public code: EngineErrorCode, message: string) {
    super(`[${code}] ${message}`);
  }
}

export interface NewHandConfig {
  players: { seat: number; stack: number; isCpu: boolean; difficulty?: Difficulty }[];
  button: number;
  blinds: { sb: number; bb: number };
  handNumber: number;
  deck: Card[];
}

// players 陣列索引：依 seat 由小到大；seatIndex 與 seat 相同值域
function indexOfSeat(players: { seat: number }[], seat: number): number {
  const i = players.findIndex((p) => p.seat === seat);
  if (i < 0) throw new EngineError('BAD_AMOUNT', `座位 ${seat} 不存在`);
  return i;
}

function seatAfter(players: { seat: number }[], seat: number, steps = 1): number {
  const i = indexOfSeat(players, seat);
  return players[(i + steps) % players.length].seat;
}

function postBlind(p: Player, amount: number): void {
  const posted = Math.min(p.stack, amount);
  p.stack -= posted;
  p.committed = posted;
  p.totalCommitted = posted;
  if (p.stack === 0) p.state = 'allin';
}

export function newHand(config: NewHandConfig): GameState {
  const { blinds, button, handNumber } = config;
  if (config.players.length < 2 || config.players.length > 6) {
    throw new EngineError('BAD_AMOUNT', '玩家數必須是 2–6');
  }
  const players: Player[] = config.players.map((p) => ({
    seat: p.seat,
    stack: p.stack,
    hole: null,
    state: 'active',
    committed: 0,
    totalCommitted: 0,
    actedThisRound: false,
    isCpu: p.isCpu,
    difficulty: p.difficulty,
  }));

  const headsUp = players.length === 2;
  const sbSeat = headsUp ? button : seatAfter(players, button, 1);
  const bbSeat = headsUp ? seatAfter(players, button, 1) : seatAfter(players, button, 2);
  postBlind(players[indexOfSeat(players, sbSeat)], blinds.sb);
  postBlind(players[indexOfSeat(players, bbSeat)], blinds.bb);

  // 發牌：從 button 下一位起每人 2 張
  const deck = [...config.deck];
  for (let n = 0; n < players.length; n++) {
    const seat = seatAfter(players, button, n + 1);
    const p = players[indexOfSeat(players, seat)];
    p.hole = [deck.shift()!, deck.shift()!];
  }

  // preflop 行動起點：HU 由 button；否則 BB 下一位
  const firstToAct = headsUp ? button : seatAfter(players, bbSeat, 1);

  return {
    players,
    button,
    street: 'preflop',
    board: [],
    deck,
    pots: [],
    toAct: firstToAct,
    currentBet: blinds.bb,
    minRaise: blinds.bb,
    blinds,
    handNumber,
    result: null,
  };
}

// 從 button 順時針依序：BTN, SB, BB, UTG, MP, CO（後位優先補滿）
const POSITION_ORDERS: Record<number, Position[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'MP', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO'],
};

export function positionOf(state: GameState, seat: number): Position {
  const order = POSITION_ORDERS[state.players.length];
  const buttonIdx = indexOfSeat(state.players, state.button);
  const seatIdx = indexOfSeat(state.players, seat);
  const offset = (seatIdx - buttonIdx + state.players.length) % state.players.length;
  return order[offset];
}

export function nextButton(state: GameState): number {
  return seatAfter(state.players, state.button, 1);
}

function clone(state: GameState): GameState {
  return structuredClone(state);
}

function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => p.state === 'active');
}

function inHandPlayers(state: GameState): Player[] {
  return state.players.filter((p) => p.state !== 'folded');
}

export function legalActions(state: GameState): {
  fold: boolean;
  check: boolean;
  call: { amount: number } | null;
  raise: { min: number; max: number } | null;
} {
  if (state.toAct === null || state.street === 'handOver' || state.street === 'showdown') {
    return { fold: false, check: false, call: null, raise: null };
  }
  const p = state.players.find((x) => x.seat === state.toAct)!;
  const owe = state.currentBet - p.committed;
  const canRaise = !p.actedThisRound && p.stack > Math.max(owe, 0);
  const allInTo = p.committed + p.stack;
  return {
    fold: true,
    check: owe === 0,
    call: owe > 0 ? { amount: Math.min(owe, p.stack) } : null,
    raise: canRaise
      ? { min: Math.min(state.currentBet + state.minRaise, allInTo), max: allInTo }
      : null,
  };
}

function findNextToAct(state: GameState, fromSeat: number): number | null {
  const n = state.players.length;
  const fromIdx = state.players.findIndex((p) => p.seat === fromSeat);
  for (let step = 1; step <= n; step++) {
    const p = state.players[(fromIdx + step) % n];
    if (p.state !== 'active') continue;
    if (p.committed < state.currentBet || !p.actedThisRound) return p.seat;
  }
  return null;
}

function dealBoard(state: GameState, count: number): void {
  for (let i = 0; i < count; i++) state.board.push(state.deck.shift()!);
}

const NEXT_STREET: Partial<Record<Street, { street: Street; deal: number }>> = {
  preflop: { street: 'flop', deal: 3 },
  flop: { street: 'turn', deal: 1 },
  turn: { street: 'river', deal: 1 },
};

function startNextStreet(state: GameState): void {
  const next = NEXT_STREET[state.street]!;
  state.street = next.street;
  dealBoard(state, next.deal);
  for (const p of state.players) {
    p.committed = 0;
    p.actedThisRound = false;
  }
  state.currentBet = 0;
  state.minRaise = state.blinds.bb;
  state.toAct = findNextToAct(state, state.button);
}

// 獨立函式：TS narrowing 在函式邊界重置。若把 while 迴圈內聯在 afterAction 的
// `if (street === 'river')` 之後，tsc 會誤判為無交集比較（TS2367）導致 build 失敗
function runOutAndSettle(state: GameState): void {
  while (state.street !== 'river') startNextStreetForRunOut(state);
  settleHand(state);
}

function afterAction(state: GameState): GameState {
  // 只剩一人未棄牌 → 結束
  if (inHandPlayers(state).length === 1) {
    settleHand(state); // Task 7 實作；本任務先用 stub
    return state;
  }
  const next = findNextToAct(state, state.toAct!);
  if (next !== null) {
    state.toAct = next;
    return state;
  }
  // 下注圈結束
  if (activePlayers(state).length < 2) {
    runOutAndSettle(state); // 發完剩餘公共牌直接攤牌（Task 7 完成結算）
    return state;
  }
  if (state.street === 'river') {
    settleHand(state);
    return state;
  }
  startNextStreet(state);
  // 換街後若無人可行動（例如僅剩一名 active、其餘 all-in）→ 繼續 run-out
  if (state.toAct === null) runOutAndSettle(state);
  return state;
}

function startNextStreetForRunOut(state: GameState): void {
  const next = NEXT_STREET[state.street]!;
  state.street = next.street;
  dealBoard(state, next.deal);
}

// Task 7 會完整實作彩池結算；本任務的 stub 僅轉換狀態讓狀態機不卡住
function settleHand(state: GameState): void {
  state.street = 'handOver';
  state.toAct = null;
}

export function applyAction(state: GameState, action: Action): GameState {
  if (state.street === 'handOver' || state.street === 'showdown' || state.toAct === null) {
    throw new EngineError('BAD_TIMING', '目前不可行動');
  }
  const s = clone(state);
  const p = s.players.find((x) => x.seat === s.toAct)!;
  const la = legalActions(s);
  const owe = s.currentBet - p.committed;

  switch (action.type) {
    case 'fold': {
      p.state = 'folded';
      break;
    }
    case 'check': {
      if (!la.check) throw new EngineError('ILLEGAL_ACTION', '面對下注不能過牌');
      break;
    }
    case 'call': {
      if (!la.call) throw new EngineError('ILLEGAL_ACTION', '無注可跟');
      const pay = la.call.amount;
      p.stack -= pay;
      p.committed += pay;
      p.totalCommitted += pay;
      if (p.stack === 0) p.state = 'allin';
      break;
    }
    case 'raise': {
      if (!la.raise) throw new EngineError('ILLEGAL_ACTION', '目前不可加注');
      const allInTo = p.committed + p.stack;
      if (action.to > allInTo) throw new EngineError('BAD_AMOUNT', '加注超過身家');
      if (action.to <= s.currentBet) throw new EngineError('BAD_AMOUNT', '加注必須高於目前注額');
      const isFullRaise = action.to - s.currentBet >= s.minRaise;
      if (!isFullRaise && action.to !== allInTo) {
        throw new EngineError('BELOW_MIN_RAISE', `最小加注到 ${s.currentBet + s.minRaise}`);
      }
      const pay = action.to - p.committed;
      p.stack -= pay;
      p.committed = action.to;
      p.totalCommitted += pay;
      if (p.stack === 0) p.state = 'allin';
      if (isFullRaise) {
        s.minRaise = action.to - s.currentBet;
        for (const other of s.players) {
          if (other.seat !== p.seat) other.actedThisRound = false;
        }
      }
      s.currentBet = action.to;
      break;
    }
  }
  p.actedThisRound = true;
  return afterAction(s);
}
