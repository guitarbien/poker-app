import { describe, it, expect } from 'vitest';
import { cards } from './deck';
import { HAND_CATEGORY as H, evaluate5, evaluate7, best7, decodeScore } from './evaluator';

const cat5 = (...s: string[]) => decodeScore(evaluate5(cards(...s))).category;

describe('evaluate5 牌型分類', () => {
  it('各牌型分類正確', () => {
    expect(cat5('As', 'Kd', '9h', '5c', '2s')).toBe(H.HIGH_CARD);
    expect(cat5('As', 'Ad', '9h', '5c', '2s')).toBe(H.PAIR);
    expect(cat5('As', 'Ad', '9h', '9c', '2s')).toBe(H.TWO_PAIR);
    expect(cat5('As', 'Ad', 'Ah', '9c', '2s')).toBe(H.TRIPS);
    expect(cat5('9s', '8d', '7h', '6c', '5s')).toBe(H.STRAIGHT);
    expect(cat5('As', 'Js', '9s', '5s', '2s')).toBe(H.FLUSH);
    expect(cat5('As', 'Ad', 'Ah', '9c', '9s')).toBe(H.FULL_HOUSE);
    expect(cat5('As', 'Ad', 'Ah', 'Ac', '2s')).toBe(H.QUADS);
    expect(cat5('9s', '8s', '7s', '6s', '5s')).toBe(H.STRAIGHT_FLUSH);
  });

  it('輪子順：A2345 是順子且高張為 5（rank 3）', () => {
    const score = evaluate5(cards('As', '2c', '3d', '4h', '5s'));
    expect(decodeScore(score).category).toBe(H.STRAIGHT);
    expect(decodeScore(score).tiebreakers[0]).toBe(3);
    // 輪子順輸給 23456
    expect(score).toBeLessThan(evaluate5(cards('2s', '3c', '4d', '5h', '6s')));
    // AKQJT 是最大的順子
    expect(evaluate5(cards('As', 'Kc', 'Qd', 'Jh', 'Ts'))).toBeGreaterThan(
      evaluate5(cards('Ks', 'Qc', 'Jd', 'Th', '9s')),
    );
  });

  it('同花輪子順是同花順', () => {
    expect(cat5('As', '2s', '3s', '4s', '5s')).toBe(H.STRAIGHT_FLUSH);
  });

  it('A2346 不是順子', () => {
    expect(cat5('As', '2c', '3d', '4h', '6s')).toBe(H.HIGH_CARD);
  });

  it('kicker 逐張比較', () => {
    // AKQJ9 > AKQJ8
    expect(evaluate5(cards('As', 'Kd', 'Qh', 'Jc', '9s'))).toBeGreaterThan(
      evaluate5(cards('Ac', 'Kh', 'Qs', 'Jd', '8c')),
    );
    // 同牌型同 kicker（不同花色）平手
    expect(evaluate5(cards('As', 'Kd', 'Qh', 'Jc', '9s'))).toBe(
      evaluate5(cards('Ad', 'Kc', 'Qs', 'Jh', '9d')),
    );
  });

  it('對子/兩對/葫蘆的主副排序正確', () => {
    // 對 A 帶 KQ9 > 對 A 帶 KQ8
    expect(evaluate5(cards('As', 'Ad', 'Kh', 'Qc', '9s'))).toBeGreaterThan(
      evaluate5(cards('Ac', 'Ah', 'Ks', 'Qd', '8c')),
    );
    // 兩對：大對優先——AA22 > KKQQ
    expect(evaluate5(cards('As', 'Ad', '2h', '2c', '9s'))).toBeGreaterThan(
      evaluate5(cards('Ks', 'Kd', 'Qh', 'Qc', '9s')),
    );
    // 葫蘆：三條 rank 優先——222AA < 333KK
    expect(evaluate5(cards('2s', '2d', '2h', 'Ac', 'As'))).toBeLessThan(
      evaluate5(cards('3s', '3d', '3h', 'Kc', 'Ks')),
    );
  });

  it('牌型類別間的強弱正確（同花 > 順子 > 三條…）', () => {
    const flush = evaluate5(cards('As', 'Js', '9s', '5s', '2s'));
    const straight = evaluate5(cards('As', 'Kc', 'Qd', 'Jh', 'Ts'));
    const trips = evaluate5(cards('As', 'Ad', 'Ah', 'Kc', 'Qs'));
    expect(flush).toBeGreaterThan(straight);
    expect(straight).toBeGreaterThan(trips);
  });

  it('張數不是 5 丟錯誤', () => {
    expect(() => evaluate5(cards('As', 'Kd'))).toThrow();
  });
});

describe('evaluate7 / best7', () => {
  it('7 張裡挑出最佳 5 張：三條+一對 → 葫蘆', () => {
    // AhAd + 板 Kh Kd Kc Qs 2d：最佳是 KKK + AA
    const seven = cards('Ah', 'Ad', 'Kh', 'Kd', 'Kc', 'Qs', '2d');
    const { score, five } = best7(seven);
    expect(decodeScore(score).category).toBe(H.FULL_HOUSE);
    expect(decodeScore(score).tiebreakers.slice(0, 2)).toEqual([11, 12]); // K 三條、A 對
    expect(five).toHaveLength(5);
    expect(evaluate5(five)).toBe(score);
  });

  it('公共牌成順也抓得到（手牌不參與）', () => {
    const seven = cards('2c', '2d', '9s', '8h', '7d', '6c', '5s');
    expect(decodeScore(evaluate7(seven)).category).toBe(H.STRAIGHT);
  });

  it('7 張同花取最大 5 張', () => {
    const seven = cards('As', 'Ks', '9s', '7s', '4s', '2s', '2d');
    const { score } = best7(seven);
    expect(decodeScore(score).category).toBe(H.FLUSH);
    // 最大同花是 A K 9 7 4
    expect(decodeScore(score).tiebreakers).toEqual([12, 11, 7, 5, 2]);
  });

  it('張數不是 7 丟錯誤', () => {
    expect(() => evaluate7(cards('As', 'Kd', 'Qh'))).toThrow();
  });
});
