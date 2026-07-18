import type { Card } from '../engine/deck';
import type { Rng } from '../engine/rng';
import { cardToString, createDeck, shuffle } from '../engine/deck';
import { best7, bestHand, decodeScore, evaluate7 } from '../engine/evaluator';
import { describeHand, HAND_NAMES } from '../engine/handNames';
import type { QuizQuestion } from './types';

export type HandReadingPayload =
  | { kind: 'best'; cards: Card[]; options: string[]; answerIdx: number }
  | { kind: 'compare'; holeA: [Card, Card]; holeB: [Card, Card]; board: Card[]; answer: 'A' | 'B' | 'tie' };

function sortedIds(cs: readonly Card[]): string {
  return [...cs].sort((a, b) => a - b).join(',');
}

export function handReadingId(p: HandReadingPayload): string {
  if (p.kind === 'best') return `hr-best:${sortedIds(p.cards)}`;
  return `hr-cmp:${sortedIds(p.holeA)}|${sortedIds(p.holeB)}|${sortedIds(p.board)}`;
}

// compare 題的判定（獨立匯出讓 tie 案例可用固定牌面測試，不靠隨機）
export function judgeCompare(holeA: readonly Card[], holeB: readonly Card[], board: readonly Card[]): 'A' | 'B' | 'tie' {
  const a = evaluate7([...holeA, ...board]);
  const b = evaluate7([...holeB, ...board]);
  return a > b ? 'A' : a < b ? 'B' : 'tie';
}

// 干擾項：從正解類別 ±1、±2 往外擴，取 3 個
function distractorCategories(correct: number, rng: Rng): number[] {
  const out: number[] = [];
  for (let d = 1; out.length < 3 && d <= 8; d++) {
    const pair = [correct - d, correct + d].filter((c) => c >= 0 && c <= 8);
    if (pair.length === 2 && rng() < 0.5) pair.reverse();
    for (const c of pair) if (out.length < 3) out.push(c);
  }
  return out;
}

export function generateHandReading(rng: Rng): QuizQuestion<HandReadingPayload> {
  const deck = shuffle(createDeck(), rng);
  let payload: HandReadingPayload;
  if (rng() < 0.5) {
    const cs = deck.slice(0, 7);
    const correct = decodeScore(best7(cs).score).category;
    const cats = [correct, ...distractorCategories(correct, rng)];
    for (let i = cats.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cats[i], cats[j]] = [cats[j], cats[i]];
    }
    payload = {
      kind: 'best',
      cards: cs,
      options: cats.map((c) => HAND_NAMES[c]),
      answerIdx: cats.indexOf(correct),
    };
  } else {
    const holeA: [Card, Card] = [deck[0], deck[1]];
    const holeB: [Card, Card] = [deck[2], deck[3]];
    const board = deck.slice(4, 9);
    payload = { kind: 'compare', holeA, holeB, board, answer: judgeCompare(holeA, holeB, board) };
  }
  return { id: handReadingId(payload), payload };
}

export function explainHandReading(p: HandReadingPayload): string {
  if (p.kind === 'best') {
    const { score, five } = best7(p.cards);
    return `最佳牌型是「${describeHand(score)}」，組成五張：${five.map(cardToString).join(' ')}`;
  }
  const a = bestHand([...p.holeA, ...p.board]);
  const b = bestHand([...p.holeB, ...p.board]);
  const verdict = p.answer === 'tie' ? '兩家平手' : `${p.answer} 家較大`;
  return `A 家：${describeHand(a.score)}（${a.five.map(cardToString).join(' ')}）；B 家：${describeHand(b.score)}（${b.five.map(cardToString).join(' ')}）→ ${verdict}`;
}
