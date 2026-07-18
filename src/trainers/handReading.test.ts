import { describe, expect, it } from 'vitest';
import { cards } from '../engine/deck';
import { best7, decodeScore } from '../engine/evaluator';
import { HAND_NAMES } from '../engine/handNames';
import { mulberry32 } from '../engine/rng';
import { explainHandReading, generateHandReading, handReadingId, judgeCompare } from './handReading';

describe('generateHandReading', () => {
  it('best 題：四個選項為不同牌型名，正解對應 best7 類別', () => {
    for (let seed = 0; seed < 200; seed++) {
      const q = generateHandReading(mulberry32(seed));
      if (q.payload.kind !== 'best') continue;
      const { cards: cs, options, answerIdx } = q.payload;
      expect(cs).toHaveLength(7);
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      expect(answerIdx).toBeGreaterThanOrEqual(0);
      expect(answerIdx).toBeLessThan(4);
      const correct = HAND_NAMES[decodeScore(best7(cs).score).category];
      expect(options[answerIdx]).toBe(correct);
    }
  });

  it('compare 題：answer 與引擎判定一致，牌不重複', () => {
    for (let seed = 0; seed < 200; seed++) {
      const q = generateHandReading(mulberry32(seed));
      if (q.payload.kind !== 'compare') continue;
      const { holeA, holeB, board, answer } = q.payload;
      const all = [...holeA, ...holeB, ...board];
      expect(new Set(all).size).toBe(9);
      expect(answer).toBe(judgeCompare(holeA, holeB, board));
    }
  });

  it('兩種題型都會出現', () => {
    const kinds = new Set<string>();
    for (let seed = 0; seed < 50; seed++) kinds.add(generateHandReading(mulberry32(seed)).payload.kind);
    expect(kinds).toEqual(new Set(['best', 'compare']));
  });

  it('id 決定性：同 seed 同 id，不同題不同 id', () => {
    const a = generateHandReading(mulberry32(42));
    const b = generateHandReading(mulberry32(42));
    const c = generateHandReading(mulberry32(43));
    expect(a.id).toBe(b.id);
    expect(handReadingId(a.payload)).toBe(a.id);
    expect(a.id).not.toBe(c.id);
  });
});

describe('judgeCompare（rigged 固定牌面）', () => {
  it('board 成順且兩家都用不上手牌 → tie', () => {
    const board = cards('Th', 'Jc', 'Qd', 'Ks', 'Ah');
    expect(judgeCompare(cards('2c', '3d'), cards('4h', '5s'), board)).toBe('tie');
  });

  it('同牌級不同 kicker → 高 kicker 勝', () => {
    const board = cards('Th', 'Tc', '5d', '8s', '2h');
    expect(judgeCompare(cards('Ah', 'Kd'), cards('Qh', 'Jd'), board)).toBe('A');
    expect(judgeCompare(cards('Qh', 'Jd'), cards('Ah', 'Kd'), board)).toBe('B');
  });

  it('雙方同兩對同 kicker → tie', () => {
    const board = cards('Th', 'Tc', '5d', '5s', 'Ah');
    expect(judgeCompare(cards('2c', '3d'), cards('2h', '4s'), board)).toBe('tie');
  });
});

describe('explainHandReading', () => {
  it('best 題解說含牌型描述與五張組成', () => {
    const cs = cards('Ah', 'Kh', 'Qh', 'Jh', 'Th', '2c', '3d');
    const text = explainHandReading({ kind: 'best', cards: cs, options: [], answerIdx: 0 });
    expect(text).toContain('同花順');
    expect(text).toContain('Ah');
  });

  it('compare tie 題解說含平手', () => {
    const text = explainHandReading({
      kind: 'compare',
      holeA: cards('2c', '3d') as [number, number],
      holeB: cards('4h', '5s') as [number, number],
      board: cards('Th', 'Jc', 'Qd', 'Ks', 'Ah'),
      answer: 'tie',
    });
    expect(text).toContain('平手');
  });
});
