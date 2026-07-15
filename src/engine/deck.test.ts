import { describe, it, expect } from 'vitest';
import { mulberry32 } from './rng';
import {
  cardToString, parseCard, cards, createDeck, shuffle, rankOf, suitOf,
} from './deck';

describe('牌編碼', () => {
  it('cardToString：0 是 2c、51 是 As', () => {
    expect(cardToString(0)).toBe('2c');
    expect(cardToString(51)).toBe('As');
    expect(cardToString(parseCard('Td'))).toBe('Td');
  });

  it('rank/suit 對應 spec 編碼', () => {
    expect(rankOf(parseCard('2c'))).toBe(0);
    expect(rankOf(parseCard('As'))).toBe(12);
    expect(suitOf(parseCard('Ac'))).toBe(0);
    expect(suitOf(parseCard('As'))).toBe(3);
  });

  it('parseCard 與 cardToString 對 52 張牌互為反函式', () => {
    for (let c = 0; c < 52; c++) {
      expect(parseCard(cardToString(c))).toBe(c);
    }
  });

  it('parseCard 對非法輸入丟錯誤', () => {
    expect(() => parseCard('1s')).toThrow();
    expect(() => parseCard('Ax')).toThrow();
    expect(() => parseCard('')).toThrow();
    expect(() => parseCard('Asd')).toThrow();
  });

  it('cards() 一次解析多張', () => {
    expect(cards('As', 'Kd')).toEqual([parseCard('As'), parseCard('Kd')]);
  });
});

describe('牌堆與洗牌', () => {
  it('createDeck 回傳 0..51 共 52 張不重複', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
    expect(Math.min(...deck)).toBe(0);
    expect(Math.max(...deck)).toBe(51);
  });

  it('shuffle 是 52 張的排列、不改動原陣列、同 seed 結果相同', () => {
    const deck = createDeck();
    const a = shuffle(deck, mulberry32(1));
    const b = shuffle(deck, mulberry32(1));
    const c = shuffle(deck, mulberry32(2));
    expect(deck).toEqual(createDeck()); // 原陣列不變
    expect([...a].sort((x, y) => x - y)).toEqual(createDeck());
    expect(a).toEqual(b);       // 同 seed 可重現
    expect(a).not.toEqual(c);   // 不同 seed 不同結果
  });
});

describe('mulberry32', () => {
  it('回傳 [0,1) 且同 seed 序列相同', () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = r1();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(v).toBe(r2());
    }
  });
});
