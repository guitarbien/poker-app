import { describe, it, expect } from 'vitest';
import { parseCard } from './deck';
import {
  handClassOf, parseRangeString, combosOf, isInRange, RFI_RANGES,
} from './ranges';

const hc = (a: string, b: string) => handClassOf(parseCard(a), parseCard(b));

describe('handClassOf', () => {
  it('對子、同花、不同花分類正確且與順序無關', () => {
    expect(hc('As', 'Ad')).toBe('AA');
    expect(hc('As', 'Ks')).toBe('AKs');
    expect(hc('As', 'Kd')).toBe('AKo');
    expect(hc('Kd', 'As')).toBe('AKo'); // 高牌在前
    expect(hc('2c', '7d')).toBe('72o');
  });
});

describe('parseRangeString', () => {
  it('對子加號：77+ 展開為 77–AA', () => {
    const r = parseRangeString('77+');
    expect(r.size).toBe(8);
    expect(r.has('77')).toBe(true);
    expect(r.has('AA')).toBe(true);
    expect(r.has('66')).toBe(false);
  });

  it('非對子加號：固定高牌、低牌升到高牌-1', () => {
    expect([...parseRangeString('ATs+')].sort()).toEqual(['AJs', 'AKs', 'AQs', 'ATs']);
    expect(parseRangeString('A5o+').size).toBe(9); // A5o–AKo
    expect([...parseRangeString('T8s+')].sort()).toEqual(['T8s', 'T9s']);
  });

  it('逗號分隔多 token、允許空白', () => {
    const r = parseRangeString('77+, ATs+, KQo');
    expect(r.size).toBe(8 + 4 + 1);
    expect(r.has('KQo')).toBe(true);
  });

  it('非法 token 丟錯誤', () => {
    expect(() => parseRangeString('AK')).toThrow();   // 缺 s/o
    expect(() => parseRangeString('77s')).toThrow();  // 對子不能有 s/o
    expect(() => parseRangeString('A1s')).toThrow();  // 非法 rank
    expect(() => parseRangeString('KAs')).toThrow();  // 高牌必須在前
  });
});

describe('combosOf', () => {
  it('對子 6 組、同花 4 組、不同花 12 組', () => {
    expect(combosOf('AA')).toHaveLength(6);
    expect(combosOf('AKs')).toHaveLength(4);
    expect(combosOf('AKo')).toHaveLength(12);
  });

  it('組合內容正確（同花兩張同花色、rank 對應）', () => {
    for (const [a, b] of combosOf('AKs')) {
      expect(a % 4).toBe(b % 4);
      expect([Math.floor(a / 4), Math.floor(b / 4)].sort((x, y) => y - x)).toEqual([12, 11]);
    }
  });
});

describe('RFI_RANGES（spec 附錄 A）', () => {
  // 附錄 A 驗算過的精確 combo 數：UTG 144, MP 186, CO 270, BTN 466, SB 346
  const combosInRange = (r: Set<string>) =>
    [...r].reduce((n, c) => n + combosOf(c).length, 0);

  it('各位置 combo 總數與 spec 附錄 A 一致', () => {
    expect(combosInRange(RFI_RANGES.UTG)).toBe(144);
    expect(combosInRange(RFI_RANGES.MP)).toBe(186);
    expect(combosInRange(RFI_RANGES.CO)).toBe(270);
    expect(combosInRange(RFI_RANGES.BTN)).toBe(466);
    expect(combosInRange(RFI_RANGES.SB)).toBe(346);
  });

  it('範圍由前位到後位單調放寬', () => {
    for (const c of RFI_RANGES.UTG) expect(RFI_RANGES.MP.has(c)).toBe(true);
    for (const c of RFI_RANGES.MP) expect(RFI_RANGES.CO.has(c)).toBe(true);
    for (const c of RFI_RANGES.CO) expect(RFI_RANGES.BTN.has(c)).toBe(true);
  });

  it('抽樣檢查：UTG 開 AJo 不開 ATo；BTN 開 54s', () => {
    expect(RFI_RANGES.UTG.has('AJo')).toBe(true);
    expect(RFI_RANGES.UTG.has('ATo')).toBe(false);
    expect(RFI_RANGES.BTN.has('54s')).toBe(true);
  });
});

describe('isInRange', () => {
  it('依牌面判斷是否在範圍內', () => {
    const r = parseRangeString('ATs+');
    expect(isInRange(r, parseCard('As'), parseCard('Js'))).toBe(true);
    expect(isInRange(r, parseCard('As'), parseCard('Jd'))).toBe(false);
  });
});
