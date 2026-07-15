import type { Card } from './deck';
import { rankOf, suitOf } from './deck';

export const HAND_CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
} as const;

const NIBBLES = 16 ** 5;

function encode(category: number, tiebreakers: number[]): number {
  let score = category;
  for (let i = 0; i < 5; i++) score = score * 16 + (tiebreakers[i] ?? 0);
  return score;
}

export function decodeScore(score: number): { category: number; tiebreakers: number[] } {
  const category = Math.floor(score / NIBBLES);
  let rest = score % NIBBLES;
  const tiebreakers: number[] = [];
  for (let i = 4; i >= 0; i--) {
    tiebreakers[i] = rest % 16;
    rest = Math.floor(rest / 16);
  }
  return { category, tiebreakers };
}

export function evaluate5(five: readonly Card[]): number {
  if (five.length !== 5) throw new Error('evaluate5 需要恰好 5 張牌');
  const ranks = five.map(rankOf).sort((a, b) => b - a);
  const isFlush = five.every((c) => suitOf(c) === suitOf(five[0]));

  let straightHigh = -1;
  const unique = new Set(ranks).size === 5;
  if (unique && ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
  else if (unique && ranks[0] === 12 && ranks[1] === 3 && ranks[2] === 2 && ranks[3] === 1 && ranks[4] === 0) {
    straightHigh = 3; // 輪子順 A2345，高張是 5
  }

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // 依（張數多優先、rank 大優先）排序的 [rank, count]
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  const H = HAND_CATEGORY;
  if (isFlush && straightHigh >= 0) return encode(H.STRAIGHT_FLUSH, [straightHigh]);
  if (groups[0][1] === 4) return encode(H.QUADS, [groups[0][0], groups[1][0]]);
  if (groups[0][1] === 3 && groups[1][1] === 2) return encode(H.FULL_HOUSE, [groups[0][0], groups[1][0]]);
  if (isFlush) return encode(H.FLUSH, ranks);
  if (straightHigh >= 0) return encode(H.STRAIGHT, [straightHigh]);
  if (groups[0][1] === 3) return encode(H.TRIPS, [groups[0][0], groups[1][0], groups[2][0]]);
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    return encode(H.TWO_PAIR, [groups[0][0], groups[1][0], groups[2][0]]);
  }
  if (groups[0][1] === 2) {
    return encode(H.PAIR, [groups[0][0], groups[1][0], groups[2][0], groups[3][0]]);
  }
  return encode(H.HIGH_CARD, ranks);
}

// ponytail: 21 種組合逐一評分，O(21) 夠快也最不會錯；效能真的不夠再換查表法
export function best7(seven: readonly Card[]): { score: number; five: Card[] } {
  if (seven.length !== 7) throw new Error('best7 需要恰好 7 張牌');
  let bestScore = -1;
  let bestFive: Card[] = [];
  for (let i = 0; i < 6; i++) {
    for (let j = i + 1; j < 7; j++) {
      const five = seven.filter((_, k) => k !== i && k !== j);
      const score = evaluate5(five);
      if (score > bestScore) {
        bestScore = score;
        bestFive = five;
      }
    }
  }
  return { score: bestScore, five: bestFive };
}

export function evaluate7(seven: readonly Card[]): number {
  return best7(seven).score;
}
