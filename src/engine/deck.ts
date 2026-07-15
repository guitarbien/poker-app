import type { Rng } from './rng';

export type Card = number; // 0–51；rank = floor(card/4)，suit = card%4（spec §4）

export const RANK_CHARS = '23456789TJQKA';
export const SUIT_CHARS = 'cdhs';

export function rankOf(card: Card): number {
  return Math.floor(card / 4);
}

export function suitOf(card: Card): number {
  return card % 4;
}

export function cardToString(card: Card): string {
  return RANK_CHARS[rankOf(card)] + SUIT_CHARS[suitOf(card)];
}

export function parseCard(s: string): Card {
  if (s.length !== 2) throw new Error(`非法的牌字串: "${s}"`);
  const rank = RANK_CHARS.indexOf(s[0]);
  const suit = SUIT_CHARS.indexOf(s[1]);
  if (rank < 0 || suit < 0) throw new Error(`非法的牌字串: "${s}"`);
  return rank * 4 + suit;
}

export function cards(...strs: string[]): Card[] {
  return strs.map(parseCard);
}

export function createDeck(): Card[] {
  return Array.from({ length: 52 }, (_, i) => i);
}

// Fisher-Yates，回傳新陣列
export function shuffle(deck: readonly Card[], rng: Rng): Card[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
