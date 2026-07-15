import type { Rng } from '../engine/rng';
import type { GameState, Action, Difficulty } from '../engine/game';
import { legalActions } from '../engine/game';
import { bestHand, decodeScore } from '../engine/evaluator';
import { rankOf } from '../engine/deck';

// 粗略強度 0–8：preflop 用查表、postflop 用當前成牌類別
function roughStrength(state: GameState, seat: number): number {
  const p = state.players.find((x) => x.seat === seat)!;
  const [a, b] = p.hole!;
  if (state.street === 'preflop') {
    const hi = Math.max(rankOf(a), rankOf(b));
    const lo = Math.min(rankOf(a), rankOf(b));
    if (hi === lo) return hi >= 8 ? 4 : 3;              // TT+ 強、小對子中
    if (hi === 12 && lo >= 10) return 4;                 // AQ/AK
    if (hi >= 10 && lo >= 8) return 2;                   // 兩張高張
    if (hi >= 10) return 1;
    return 0;
  }
  const category = decodeScore(bestHand([a, b, ...state.board]).score).category;
  if (category >= 2) return 4;  // 兩對以上：強
  if (category === 1) return 2; // 一對：中
  return 0;                     // 高牌：弱
}

// easy 的加注尺寸：最小加注 ~ 最小加注+3BB，夾在合法區間內
function easyRaiseTo(state: GameState, min: number, max: number, rng: Rng): number {
  const to = min + Math.floor(rng() * 4) * state.blinds.bb;
  return Math.max(min, Math.min(max, to));
}

// ponytail: M2 只有 easy；M3 在這裡分派 normal/hard
export function decideAction(state: GameState, seat: number, _difficulty: Difficulty, rng: Rng): Action {
  const la = legalActions(state);
  const strength = roughStrength(state, seat);
  const r = rng();

  if (strength >= 4) {
    if (la.raise && r < 0.6) return { type: 'raise', to: easyRaiseTo(state, la.raise.min, la.raise.max, rng) };
    if (la.call) return { type: 'call' };
    if (la.check) return { type: 'check' };
    return { type: 'fold' };
  }
  if (strength >= 2) {
    if (la.raise && r < 0.15) return { type: 'raise', to: easyRaiseTo(state, la.raise.min, la.raise.max, rng) };
    if (la.check) return { type: 'check' };
    if (la.call && r < 0.7) return { type: 'call' };
    return { type: 'fold' };
  }
  if (la.raise && r < 0.05) return { type: 'raise', to: easyRaiseTo(state, la.raise.min, la.raise.max, rng) };
  if (la.check) return { type: 'check' };
  if (la.call && r < 0.2) return { type: 'call' };
  return { type: 'fold' };
}
