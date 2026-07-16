import { decodeScore, HAND_CATEGORY } from '../../engine/evaluator';
import { RANK_CHARS } from '../../engine/deck';

export const HAND_NAMES = ['高牌', '一對', '兩對', '三條', '順子', '同花', '葫蘆', '四條', '同花順'] as const;

export function handName(handRank: number): string {
  return HAND_NAMES[decodeScore(handRank).category];
}

// 組出含 rank 細節的手牌描述，例：「兩對：K 和 7」「一對：A」「順子：9 高」
export function describeHand(score: number): string {
  const { category, tiebreakers: tb } = decodeScore(score);
  const r = (i: number) => RANK_CHARS[tb[i]];
  switch (category) {
    case HAND_CATEGORY.HIGH_CARD: return `高牌：${r(0)} 高`;
    case HAND_CATEGORY.PAIR: return `一對：${r(0)}`;
    case HAND_CATEGORY.TWO_PAIR: return `兩對：${r(0)} 和 ${r(1)}`;
    case HAND_CATEGORY.TRIPS: return `三條：${r(0)}`;
    case HAND_CATEGORY.STRAIGHT: return `順子：${r(0)} 高`;
    case HAND_CATEGORY.FLUSH: return `同花：${r(0)} 高`;
    case HAND_CATEGORY.FULL_HOUSE: return `葫蘆：${r(0)} 配 ${r(1)}`;
    case HAND_CATEGORY.QUADS: return `四條：${r(0)}`;
    case HAND_CATEGORY.STRAIGHT_FLUSH: return `同花順：${r(0)} 高`;
    default: return HAND_NAMES[category] ?? '未知';
  }
}
