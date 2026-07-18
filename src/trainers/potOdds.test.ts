import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../engine/rng';
import { explainPotOdds, generatePotOdds, makePotOddsQuestion } from './potOdds';

const POTS = Array.from({ length: 19 }, (_, i) => 20 + i * 10); // 20..200
const RATIOS = [1 / 4, 1 / 3, 1 / 2, 2 / 3, 1];

function pctOf(option: string): number {
  return Number(option.replace(/[^0-9]/g, ''));
}

describe('generatePotOdds', () => {
  it('欄位完整、pot/call 落在規定集合、required 精確', () => {
    for (let seed = 0; seed < 100; seed++) {
      const q = generatePotOdds(mulberry32(seed));
      const { pot, call, options, answerIdx, required } = q.payload;
      expect(POTS).toContain(pot);
      expect(RATIOS.map((r) => Math.round(pot * r))).toContain(call);
      expect(required).toBeCloseTo(call / (pot + call), 10);
      expect(options).toHaveLength(4);
      expect(pctOf(options[answerIdx])).toBe(Math.round(required * 100));
    }
  });

  it('窮舉所有 pot/call 組合：四選項彼此差 ≥5 個百分點且含正解', () => {
    for (const pot of POTS) {
      for (const r of RATIOS) {
        const call = Math.round(pot * r);
        for (let seed = 0; seed < 5; seed++) {
          const q = makePotOddsQuestion(pot, call, mulberry32(seed));
          const values = q.payload.options.map(pctOf);
          for (let i = 0; i < 4; i++) {
            for (let j = i + 1; j < 4; j++) {
              expect(Math.abs(values[i] - values[j])).toBeGreaterThanOrEqual(5);
            }
          }
          expect(values[q.payload.answerIdx]).toBe(Math.round(q.payload.required * 100));
        }
      }
    }
  });

  it('id 決定性：同 pot/call 同 id，不同 seed 同 id', () => {
    const a = makePotOddsQuestion(100, 50, mulberry32(1));
    const b = makePotOddsQuestion(100, 50, mulberry32(99));
    expect(a.id).toBe(b.id);
    expect(makePotOddsQuestion(100, 33, mulberry32(1)).id).not.toBe(a.id);
  });

  it('解說含計算式', () => {
    const q = makePotOddsQuestion(100, 50, mulberry32(1));
    const text = explainPotOdds(q.payload);
    expect(text).toContain('50');
    expect(text).toContain('100');
    expect(text).toContain('33.3');
  });
});
