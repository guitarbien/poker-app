import type { Card } from './deck';
import type { Rng } from './rng';
import type { Range } from './ranges';
import { evaluate7 } from './evaluator';
import { combosOf } from './ranges';

// spec §5：預設模擬次數
export const DEFAULT_ITERATIONS = 2000;

function poolWithout(dead: ReadonlySet<Card>): Card[] {
  const pool: Card[] = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) pool.push(c);
  return pool;
}

// 就地部分 Fisher-Yates：把 pool 前 n 格換成隨機抽出的 n 張
function sampleInto(pool: Card[], n: number, rng: Rng): void {
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
}

export function equity(
  hole: readonly Card[],
  board: readonly Card[],
  opponents: number,
  iterations: number,
  rng: Rng,
): number {
  const pool = poolWithout(new Set([...hole, ...board]));
  const boardNeed = 5 - board.length;
  const need = opponents * 2 + boardNeed;
  let total = 0;
  for (let it = 0; it < iterations; it++) {
    sampleInto(pool, need, rng);
    const fullBoard = [...board, ...pool.slice(opponents * 2, need)];
    const myScore = evaluate7([...hole, ...fullBoard]);
    let winners = 1;
    let beaten = false;
    for (let o = 0; o < opponents; o++) {
      const oppScore = evaluate7([pool[o * 2], pool[o * 2 + 1], ...fullBoard]);
      if (oppScore > myScore) { beaten = true; break; }
      if (oppScore === myScore) winners++;
    }
    if (!beaten) total += 1 / winners;
  }
  return total / iterations;
}

export function equityVsRange(
  hole: readonly Card[],
  board: readonly Card[],
  range: Range,
  iterations: number,
  rng: Rng,
): number {
  const dead = new Set([...hole, ...board]);
  const combos = [...range]
    .flatMap((hc) => combosOf(hc))
    .filter(([a, b]) => !dead.has(a) && !dead.has(b));
  if (combos.length === 0) throw new Error('對手範圍被完全 block，無法模擬');

  let total = 0;
  for (let it = 0; it < iterations; it++) {
    const [oa, ob] = combos[Math.floor(rng() * combos.length)];
    const pool = poolWithout(new Set([...hole, ...board, oa, ob]));
    sampleInto(pool, 5 - board.length, rng);
    const fullBoard = [...board, ...pool.slice(0, 5 - board.length)];
    const myScore = evaluate7([...hole, ...fullBoard]);
    const oppScore = evaluate7([oa, ob, ...fullBoard]);
    if (myScore > oppScore) total += 1;
    else if (myScore === oppScore) total += 0.5;
  }
  return total / iterations;
}
