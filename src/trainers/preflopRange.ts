import type { Card } from '../engine/deck';
import { createDeck, RANK_CHARS, shuffle } from '../engine/deck';
import type { Rng } from '../engine/rng';
import type { Position } from '../engine/ranges';
import { handClassOf, isInRange, RFI_RANGES } from '../engine/ranges';
import type { QuizQuestion } from './types';

export interface PreflopRangePayload {
  position: Exclude<Position, 'BB'>;
  hole: [Card, Card];
  answer: 'open' | 'fold';
}

const POSITIONS: Exclude<Position, 'BB'>[] = ['UTG', 'MP', 'CO', 'BTN', 'SB'];

export function preflopRangeId(p: { position: string; hole: readonly Card[] }): string {
  return `pr:${p.position}:${[...p.hole].sort((a, b) => a - b).join(',')}`;
}

export function generatePreflopRange(rng: Rng): QuizQuestion<PreflopRangePayload> {
  const position = POSITIONS[Math.floor(rng() * POSITIONS.length)];
  const deck = shuffle(createDeck(), rng);
  const hole: [Card, Card] = [deck[0], deck[1]];
  const payload: PreflopRangePayload = {
    position,
    hole,
    answer: isInRange(RFI_RANGES[position], hole[0], hole[1]) ? 'open' : 'fold',
  };
  return { id: preflopRangeId(payload), payload };
}

// 13×13：rank 由 A 到 2 遞減；對角線對子、上三角 suited、下三角 offsuit
const DESC_RANKS = [...RANK_CHARS].reverse(); // A K Q ... 2

export function rangeMatrix(
  position: Exclude<Position, 'BB'>,
  hole: [Card, Card],
): { label: string; inRange: boolean; isCurrent: boolean }[][] {
  const range = RFI_RANGES[position];
  const current = handClassOf(hole[0], hole[1]);
  return DESC_RANKS.map((ri, i) =>
    DESC_RANKS.map((rj, j) => {
      const label = i === j ? ri + rj : i < j ? ri + rj + 's' : rj + ri + 'o';
      return { label, inRange: range.has(label), isCurrent: label === current };
    }),
  );
}
