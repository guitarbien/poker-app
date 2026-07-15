import { describe, it, expect } from 'vitest';
import { cards } from './deck';
import { mulberry32 } from './rng';
import { equity, equityVsRange } from './equity';
import { parseRangeString } from './ranges';

// 理論值來源為公開撲克機率表；容差 ±2%（spec §11，固定 seed 下可重現）
describe('equity vs 隨機手牌', () => {
  it('AA 單挑約 85%', () => {
    const e = equity(cards('As', 'Ah'), [], 1, 10_000, mulberry32(42));
    expect(e).toBeGreaterThan(0.832);
    expect(e).toBeLessThan(0.872);
  });

  it('72o 單挑約 35%', () => {
    const e = equity(cards('7s', '2d'), [], 1, 10_000, mulberry32(42));
    expect(e).toBeGreaterThan(0.326);
    expect(e).toBeLessThan(0.366);
  });

  it('對手越多勝率越低', () => {
    const rng = mulberry32(7);
    const vs1 = equity(cards('As', 'Ah'), [], 1, 5_000, mulberry32(7));
    const vs4 = equity(cards('As', 'Ah'), [], 4, 5_000, rng);
    expect(vs4).toBeLessThan(vs1);
  });

  it('河牌圈拿死結（quads、無人能平）勝率為 1', () => {
    const e = equity(
      cards('9c', '9s'),
      cards('9h', '9d', '5c', '2s', '7h'),
      1,
      1_000,
      mulberry32(1),
    );
    expect(e).toBe(1);
  });

  it('同 seed 結果完全相同（可重現）', () => {
    const a = equity(cards('Ks', 'Qs'), [], 2, 2_000, mulberry32(9));
    const b = equity(cards('Ks', 'Qs'), [], 2, 2_000, mulberry32(9));
    expect(a).toBe(b);
  });
});

describe('equityVsRange', () => {
  it('AA vs {KK} 約 82%', () => {
    const e = equityVsRange(
      cards('As', 'Ah'), [], parseRangeString('KK'), 10_000, mulberry32(42),
    );
    expect(e).toBeGreaterThan(0.80);
    expect(e).toBeLessThan(0.84);
  });

  it('範圍被手牌完全 block 時丟錯誤', () => {
    // 我拿 AsAh，範圍只有 AA → 只剩 AcAd 一組，不會丟錯
    expect(() =>
      equityVsRange(cards('As', 'Ah'), [], parseRangeString('AA'), 100, mulberry32(1)),
    ).not.toThrow();
    // 板面 + 手牌用光 KK 的所有組合 → 丟錯
    expect(() =>
      equityVsRange(
        cards('Ks', 'Kh'),
        cards('Kd', 'Kc', '2s'),
        parseRangeString('KK'),
        100,
        mulberry32(1),
      ),
    ).toThrow();
  });
});
