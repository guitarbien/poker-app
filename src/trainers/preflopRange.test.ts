import { describe, expect, it } from 'vitest';
import { cards } from '../engine/deck';
import { isInRange, RFI_RANGES } from '../engine/ranges';
import { mulberry32 } from '../engine/rng';
import { generatePreflopRange, preflopRangeId, rangeMatrix } from './preflopRange';

describe('generatePreflopRange', () => {
  it('欄位完整、answer 與 isInRange 一致、position 皆會出現', () => {
    const positions = new Set<string>();
    const answers = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const q = generatePreflopRange(mulberry32(seed));
      const { position, hole, answer } = q.payload;
      positions.add(position);
      answers.add(answer);
      expect(hole[0]).not.toBe(hole[1]);
      const expected = isInRange(RFI_RANGES[position], hole[0], hole[1]) ? 'open' : 'fold';
      expect(answer).toBe(expected);
    }
    expect(positions).toEqual(new Set(['UTG', 'MP', 'CO', 'BTN', 'SB']));
    // in range 與 out of range 都會出現
    expect(answers).toEqual(new Set(['open', 'fold']));
  });

  it('id 決定性：同 seed 同 id；hole 順序無關', () => {
    const a = generatePreflopRange(mulberry32(7));
    const b = generatePreflopRange(mulberry32(7));
    expect(a.id).toBe(b.id);
    const [c1, c2] = cards('Ah', 'Kd');
    expect(preflopRangeId({ position: 'UTG', hole: [c1, c2] })).toBe(
      preflopRangeId({ position: 'UTG', hole: [c2, c1] }),
    );
  });
});

describe('rangeMatrix', () => {
  it('13×13、AA 格 inRange、72o 格 out of range、isCurrent 只有一格', () => {
    const hole = cards('Ah', 'As') as [number, number];
    const m = rangeMatrix('UTG', hole);
    expect(m).toHaveLength(13);
    for (const row of m) expect(row).toHaveLength(13);
    expect(m[0][0].label).toBe('AA');
    expect(m[0][0].inRange).toBe(true);
    expect(m[0][0].isCurrent).toBe(true);
    // 7 在遞減序 index 7、2 在 index 12；下三角 offsuit → [12][7]
    expect(m[12][7].label).toBe('72o');
    expect(m[12][7].inRange).toBe(false);
    expect(m[12][7].isCurrent).toBe(false);
    const currentCount = m.flat().filter((c) => c.isCurrent).length;
    expect(currentCount).toBe(1);
  });

  it('上三角 suited、下三角 offsuit、AKs/AKo 位置正確', () => {
    const m = rangeMatrix('BTN', cards('7h', '2d') as [number, number]);
    expect(m[0][1].label).toBe('AKs');
    expect(m[1][0].label).toBe('AKo');
    expect(m.flat().filter((c) => c.isCurrent)[0].label).toBe('72o');
  });
});
