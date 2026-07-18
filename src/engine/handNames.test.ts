import { describe, it, expect } from 'vitest';
import { cards } from './deck';
import { evaluate5, evaluate7 } from './evaluator';
import { describeHand } from './handNames';

describe('describeHand', () => {
  it('一對', () => {
    // AA + 三張不成牌的散牌
    const score = evaluate5(cards('Ah', 'Ad', '2c', '5h', '9d'));
    expect(describeHand(score)).toBe('一對：A');
  });

  it('兩對：K 和 7', () => {
    const score = evaluate5(cards('Kh', 'Kd', '7c', '7h', '2d'));
    expect(describeHand(score)).toBe('兩對：K 和 7');
  });

  it('三條', () => {
    const score = evaluate5(cards('Qh', 'Qd', 'Qc', '2h', '5d'));
    expect(describeHand(score)).toBe('三條：Q');
  });

  it('順子：9 高', () => {
    const score = evaluate5(cards('5c', '6h', '7d', '8s', '9h'));
    expect(describeHand(score)).toBe('順子：9 高');
  });

  it('順子：5 高（輪子 A2345）', () => {
    const score = evaluate5(cards('Ah', '2h', '3d', '4s', '5c'));
    expect(describeHand(score)).toBe('順子：5 高');
  });

  it('同花', () => {
    const score = evaluate5(cards('2h', '5h', '7h', 'Jh', 'Kh'));
    expect(describeHand(score)).toBe('同花：K 高');
  });

  it('葫蘆', () => {
    const score = evaluate5(cards('Ah', 'Ad', 'Ac', 'Kh', 'Kd'));
    expect(describeHand(score)).toBe('葫蘆：A 配 K');
  });

  it('四條', () => {
    const score = evaluate5(cards('Th', 'Td', 'Tc', 'Ts', '5h'));
    expect(describeHand(score)).toBe('四條：T');
  });

  it('同花順', () => {
    const score = evaluate5(cards('5h', '6h', '7h', '8h', '9h'));
    expect(describeHand(score)).toBe('同花順：9 高');
  });

  it('高牌', () => {
    const score = evaluate5(cards('2c', '5h', '7d', '9s', 'Kh'));
    expect(describeHand(score)).toBe('高牌：K 高');
  });

  it('7 張牌測試（透過 evaluate7）', () => {
    // KK + 散牌 → 一對：K
    const score = evaluate7(cards('Kh', 'Kd', '2c', '5h', '9d', '3s', '7c'));
    expect(describeHand(score)).toBe('一對：K');
  });
});
