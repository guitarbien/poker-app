import type { Rng } from '../engine/rng';
import type { GameState, Action, Difficulty, LegalActions } from '../engine/game';
import { legalActions, positionOf } from '../engine/game';
import { bestHand, decodeScore } from '../engine/evaluator';
import { rankOf } from '../engine/deck';
import { RFI_RANGES, isInRange, handClassOf, parseRangeString } from '../engine/ranges';
import { equity } from '../engine/equity';

// 粗略強度 0–4：preflop 用查表、postflop 用當前成牌類別映射
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

function potSize(state: GameState): number {
  return state.players.reduce((s, p) => s + p.totalCommitted, 0);
}

function oweOf(state: GameState, seat: number): number {
  const p = state.players.find((x) => x.seat === seat)!;
  return Math.max(0, state.currentBet - p.committed);
}

function neededEquity(state: GameState, seat: number): number {
  const owe = oweOf(state, seat);
  if (owe === 0) return 0;
  return owe / (potSize(state) + owe);
}

function clampTo(la: LegalActions, to: number): number {
  return Math.max(la.raise!.min, Math.min(la.raise!.max, Math.round(to)));
}

function betFraction(state: GameState, la: LegalActions, fraction: number): Action {
  return { type: 'raise', to: clampTo(la, state.currentBet + potSize(state) * fraction) };
}

const THREEBET_RANGE = parseRangeString('QQ+, AKs, AKo');
const CALL_RAISE_RANGE = parseRangeString('66+, ATs+, KTs+, QTs+, JTs, AJo+, KQo');

function preflopByTable(state: GameState, seat: number, rng: Rng): Action {
  const la = legalActions(state);
  const p = state.players.find((x) => x.seat === seat)!;
  const [a, b] = p.hole!;
  const unopened = state.currentBet === state.blinds.bb;
  if (unopened) {
    if (la.check) return { type: 'check' }; // BB 免費看牌
    const pos = positionOf(state, seat);
    if (pos !== 'BB' && isInRange(RFI_RANGES[pos], a, b) && la.raise) {
      return { type: 'raise', to: clampTo(la, 2.5 * state.blinds.bb) };
    }
    return { type: 'fold' };
  }
  const hc = handClassOf(a, b);
  if (THREEBET_RANGE.has(hc)) {
    if (la.raise && rng() < 0.8) return { type: 'raise', to: clampTo(la, 3 * state.currentBet) };
    if (la.call) return { type: 'call' };
  }
  if (CALL_RAISE_RANGE.has(hc) && la.call) return { type: 'call' };
  if (la.check) return { type: 'check' };
  return { type: 'fold' };
}

export function decideEasy(state: GameState, seat: number, rng: Rng): Action {
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

function decideNormal(state: GameState, seat: number, rng: Rng): Action {
  if (state.street === 'preflop') return preflopByTable(state, seat, rng);
  const la = legalActions(state);
  const p = state.players.find((x) => x.seat === seat)!;
  const category = decodeScore(bestHand([...p.hole!, ...state.board]).score).category;
  if (category >= 2) {
    if (la.raise && rng() < 0.7) return betFraction(state, la, 2 / 3);
    if (la.call) return { type: 'call' };
    if (la.check) return { type: 'check' };
    return { type: 'fold' };
  }
  if (category === 1) {
    if (la.check) {
      if (la.raise && rng() < 0.35) return betFraction(state, la, 0.5);
      return { type: 'check' };
    }
    if (la.call && neededEquity(state, seat) <= 0.30) return { type: 'call' };
    return { type: 'fold' };
  }
  if (la.check) return { type: 'check' };
  return { type: 'fold' };
}

function decideHard(state: GameState, seat: number, rng: Rng): Action {
  if (state.street === 'preflop') return preflopByTable(state, seat, rng);
  const la = legalActions(state);
  const p = state.players.find((x) => x.seat === seat)!;
  const opponents = state.players.filter((x) => x.seat !== seat && x.state !== 'folded').length;
  const eq = equity(p.hole!, state.board, opponents, 500, rng);
  const needed = neededEquity(state, seat);
  if (la.check) {
    if (eq > 0.65 && la.raise) return betFraction(state, la, 2 / 3);
    if (eq > 0.28 && eq < 0.45 && la.raise && rng() < 0.35) return betFraction(state, la, 0.5);
    return { type: 'check' };
  }
  if (eq > 0.70 && la.raise && rng() < 0.5) return betFraction(state, la, 1);
  if (eq >= needed + 0.03 && la.call) return { type: 'call' };
  if (eq > 0.30 && la.raise && rng() < 0.12) return betFraction(state, la, 2 / 3);
  return { type: 'fold' };
}

export function decideAction(state: GameState, seat: number, difficulty: Difficulty, rng: Rng): Action {
  if (difficulty === 'normal') return decideNormal(state, seat, rng);
  if (difficulty === 'hard') return decideHard(state, seat, rng);
  return decideEasy(state, seat, rng);
}
