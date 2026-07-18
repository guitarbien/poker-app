import { describe, expect, it } from 'vitest';
import { cards } from '../engine/deck';
import { mulberry32 } from '../engine/rng';
import {
  equityGuessId,
  generateEquityGuess,
  judgeEquityGuess,
  rangeHasLiveCombo,
} from './equityGuess';

describe('generateEquityGuess', () => {
  it('欄位完整：board 0/3/4 張、牌不重複、兩種對手都出現、三種 street 都出現', () => {
    const kinds = new Set<string>();
    const lens = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const q = generateEquityGuess(mulberry32(seed));
      const { hole, board, opponent } = q.payload;
      lens.add(board.length);
      kinds.add(opponent.kind);
      const all = [...hole, ...board, ...(opponent.kind === 'hand' ? opponent.hole : [])];
      expect(new Set(all).size).toBe(all.length);
      expect([0, 3, 4]).toContain(board.length);
      if (opponent.kind === 'range') {
        expect(opponent.name).toBeTruthy();
        expect(opponent.range).toBeTruthy();
      }
    }
    expect(kinds).toEqual(new Set(['hand', 'range']));
    expect(lens).toEqual(new Set([0, 3, 4]));
  });

  it('range 全被 block 時 fallback 為明牌題', () => {
    for (let seed = 0; seed < 500; seed++) {
      const q = generateEquityGuess(mulberry32(seed), [{ name: '只有AA', range: 'AA' }]);
      const dead = new Set([...q.payload.hole, ...q.payload.board]);
      if (!rangeHasLiveCombo('AA', dead)) {
        expect(q.payload.opponent.kind).toBe('hand');
      } else if (q.payload.opponent.kind === 'range') {
        expect(q.payload.opponent.name).toBe('只有AA');
      }
    }
  });

  it('rangeHasLiveCombo：死 3 張 A 後 AA 無組合', () => {
    const dead = new Set(cards('Ah', 'As', 'Ad'));
    expect(rangeHasLiveCombo('AA', dead)).toBe(false);
    expect(rangeHasLiveCombo('KK', dead)).toBe(true);
  });

  it('id 決定性：同 payload 同 id、hole 順序無關', () => {
    const a = generateEquityGuess(mulberry32(5));
    const b = generateEquityGuess(mulberry32(5));
    expect(a.id).toBe(b.id);
    const p = a.payload;
    const swapped = { ...p, hole: [p.hole[1], p.hole[0]] as [number, number] };
    expect(equityGuessId(swapped)).toBe(a.id);
  });
});

describe('judgeEquityGuess', () => {
  const payload = {
    hole: cards('Ah', 'As') as [number, number],
    board: cards('2c', '7d', 'Jh'),
    opponent: { kind: 'hand' as const, hole: cards('Kd', 'Kc') as [number, number] },
  };

  it('±5 判定邊界：4.9 對、5.1 錯（注入 rng 使 actual 可重現）', () => {
    const actual = judgeEquityGuess(payload, 0, mulberry32(1), 2000).actual;
    const base = actual * 100;
    expect(judgeEquityGuess(payload, base + 4.9, mulberry32(1), 2000).correct).toBe(true);
    expect(judgeEquityGuess(payload, base - 4.9, mulberry32(1), 2000).correct).toBe(true);
    expect(judgeEquityGuess(payload, base + 5.1, mulberry32(1), 2000).correct).toBe(false);
    expect(judgeEquityGuess(payload, base - 5.1, mulberry32(1), 2000).correct).toBe(false);
  });

  it('AA vs KK 在乾淨 flop 上勝率合理（~90%）', () => {
    const { actual } = judgeEquityGuess(payload, 90, mulberry32(2), 4000);
    expect(actual).toBeGreaterThan(0.85);
    expect(actual).toBeLessThan(0.97);
  });

  it('range 題可判定', () => {
    const p = {
      hole: cards('Ah', 'Kh') as [number, number],
      board: [] as number[],
      opponent: { kind: 'range' as const, name: '緊手開牌', range: '77+, ATs+, KQs, AJo+' },
    };
    function actualPct(pp: typeof p): number {
      return judgeEquityGuess(pp, 0, mulberry32(3), 2000).actual * 100;
    }
    const { actual, correct } = judgeEquityGuess(p, actualPct(p), mulberry32(3), 2000);
    expect(actual).toBeGreaterThan(0.3);
    expect(actual).toBeLessThan(0.7);
    expect(correct).toBe(true);
  });
});
