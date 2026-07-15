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
