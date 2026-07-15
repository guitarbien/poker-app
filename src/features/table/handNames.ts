import { decodeScore } from '../../engine/evaluator';
export const HAND_NAMES = ['高牌', '一對', '兩對', '三條', '順子', '同花', '葫蘆', '四條', '同花順'] as const;
export function handName(handRank: number): string {
  return HAND_NAMES[decodeScore(handRank).category];
}
