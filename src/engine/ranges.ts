import type { Card } from './deck';
import { RANK_CHARS, rankOf, suitOf } from './deck';

export type HandClass = string;
export type Range = Set<HandClass>;
export type Position = 'UTG' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB';

export function handClassOf(a: Card, b: Card): HandClass {
  const hi = Math.max(rankOf(a), rankOf(b));
  const lo = Math.min(rankOf(a), rankOf(b));
  if (hi === lo) return RANK_CHARS[hi] + RANK_CHARS[lo];
  const suited = suitOf(a) === suitOf(b);
  return RANK_CHARS[hi] + RANK_CHARS[lo] + (suited ? 's' : 'o');
}

const TOKEN = /^([2-9TJQKA])([2-9TJQKA])([so])?(\+)?$/;

export function parseRangeString(s: string): Range {
  const range: Range = new Set();
  for (const raw of s.split(',')) {
    const token = raw.trim();
    if (token === '') continue;
    const m = TOKEN.exec(token);
    if (!m) throw new Error(`非法的範圍 token: "${token}"`);
    const [, hiChar, loChar, suit, plus] = m;
    const hi = RANK_CHARS.indexOf(hiChar);
    const lo = RANK_CHARS.indexOf(loChar);
    if (hi === lo) {
      if (suit) throw new Error(`對子不可帶 s/o: "${token}"`);
      const top = plus ? 12 : hi;
      for (let r = hi; r <= top; r++) range.add(RANK_CHARS[r] + RANK_CHARS[r]);
    } else {
      if (hi < lo) throw new Error(`高牌必須在前: "${token}"`);
      if (!suit) throw new Error(`非對子必須指定 s 或 o: "${token}"`);
      const top = plus ? hi - 1 : lo;
      for (let l = lo; l <= top; l++) range.add(RANK_CHARS[hi] + RANK_CHARS[l] + suit);
    }
  }
  return range;
}

export function combosOf(hc: HandClass): [Card, Card][] {
  const hi = RANK_CHARS.indexOf(hc[0]);
  const lo = RANK_CHARS.indexOf(hc[1]);
  const out: [Card, Card][] = [];
  if (hi === lo) {
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = s1 + 1; s2 < 4; s2++) out.push([hi * 4 + s1, hi * 4 + s2]);
    }
  } else if (hc[2] === 's') {
    for (let s = 0; s < 4; s++) out.push([hi * 4 + s, lo * 4 + s]);
  } else {
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = 0; s2 < 4; s2++) {
        if (s1 !== s2) out.push([hi * 4 + s1, lo * 4 + s2]);
      }
    }
  }
  return out;
}

export function isInRange(range: Range, a: Card, b: Card): boolean {
  return range.has(handClassOf(a, b));
}

// spec 附錄 A：6-max RFI 開牌表（BB 無 RFI 情境）
export const RFI_RANGES: Record<Exclude<Position, 'BB'>, Range> = {
  UTG: parseRangeString('77+, ATs+, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo'),
  MP: parseRangeString('66+, A9s+, KTs+, QTs+, J9s+, T9s, 98s, 87s, ATo+, KJo+'),
  CO: parseRangeString('44+, A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, ATo+, KTo+, QJo'),
  BTN: parseRangeString(
    '22+, A2s+, K5s+, Q7s+, J8s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, A5o+, K9o+, Q9o+, J9o+, T9o',
  ),
  SB: parseRangeString('22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, A8o+, KTo+, QTo+, JTo'),
};
