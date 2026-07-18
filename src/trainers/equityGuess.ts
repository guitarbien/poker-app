import type { Card } from '../engine/deck';
import { createDeck, shuffle } from '../engine/deck';
import { DEFAULT_ITERATIONS, equityVsRange } from '../engine/equity';
import { evaluate7 } from '../engine/evaluator';
import { combosOf, parseRangeString } from '../engine/ranges';
import type { Rng } from '../engine/rng';
import type { QuizQuestion } from './types';

export interface EquityGuessPayload {
  hole: [Card, Card];
  board: Card[]; // 0/3/4 張（preflop/flop/turn）
  opponent: { kind: 'hand'; hole: [Card, Card] } | { kind: 'range'; name: string; range: string };
}

export const RANGE_PRESETS: { name: string; range: string }[] = [
  { name: '緊手開牌', range: '77+, ATs+, KQs, AJo+' },
  { name: '寬鬆跟注', range: '22+, A2s+, K9s+, QTs+, JTs, ATo+, KJo+' },
];

const BOARD_LENS = [0, 3, 4];

function sortedIds(cs: readonly Card[]): string {
  return [...cs].sort((a, b) => a - b).join(',');
}

export function equityGuessId(p: EquityGuessPayload): string {
  const opp = p.opponent.kind === 'hand' ? `h:${sortedIds(p.opponent.hole)}` : `r:${p.opponent.name}`;
  return `eq:${sortedIds(p.hole)}|${sortedIds(p.board)}|${opp}`;
}

// 範圍在指定死牌下是否還有可用組合
export function rangeHasLiveCombo(rangeStr: string, dead: ReadonlySet<Card>): boolean {
  for (const hc of parseRangeString(rangeStr)) {
    for (const [a, b] of combosOf(hc)) if (!dead.has(a) && !dead.has(b)) return true;
  }
  return false;
}

export function generateEquityGuess(
  rng: Rng,
  presets: { name: string; range: string }[] = RANGE_PRESETS,
): QuizQuestion<EquityGuessPayload> {
  const deck = shuffle(createDeck(), rng);
  const hole: [Card, Card] = [deck[0], deck[1]];
  const boardLen = BOARD_LENS[Math.floor(rng() * BOARD_LENS.length)];
  const board = deck.slice(2, 2 + boardLen);
  const dead = new Set([...hole, ...board]);

  let opponent: EquityGuessPayload['opponent'] | null = null;
  if (rng() < 0.5) {
    // 範圍題：被 block 時重抽（最多 10 次），仍失敗改出明牌題
    for (let i = 0; i < 10; i++) {
      const preset = presets[Math.floor(rng() * presets.length)];
      if (rangeHasLiveCombo(preset.range, dead)) {
        opponent = { kind: 'range', ...preset };
        break;
      }
    }
  }
  if (opponent === null) {
    opponent = { kind: 'hand', hole: [deck[2 + boardLen], deck[3 + boardLen]] };
  }
  const payload: EquityGuessPayload = { hole, board, opponent };
  return { id: equityGuessId(payload), payload };
}

// 對明牌的 MC：重用 evaluate7 補完 board（engine 的 equity() 是隨機對手，不適用）
function equityVsHand(
  hole: readonly Card[],
  oppHole: readonly Card[],
  board: readonly Card[],
  iterations: number,
  rng: Rng,
): number {
  const dead = new Set([...hole, ...oppHole, ...board]);
  const pool: Card[] = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) pool.push(c);
  const need = 5 - board.length;
  let total = 0;
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rng() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const fullBoard = [...board, ...pool.slice(0, need)];
    const my = evaluate7([...hole, ...fullBoard]);
    const opp = evaluate7([...oppHole, ...fullBoard]);
    if (my > opp) total += 1;
    else if (my === opp) total += 0.5;
  }
  return total / iterations;
}

export function judgeEquityGuess(
  p: EquityGuessPayload,
  guessPercent: number,
  rng: Rng,
  iterations: number = DEFAULT_ITERATIONS,
): { actual: number; correct: boolean } {
  const actual =
    p.opponent.kind === 'range'
      ? equityVsRange(p.hole, p.board, parseRangeString(p.opponent.range), iterations, rng)
      : equityVsHand(p.hole, p.opponent.hole, p.board, iterations, rng);
  return { actual, correct: Math.abs(guessPercent - actual * 100) <= 5 };
}
