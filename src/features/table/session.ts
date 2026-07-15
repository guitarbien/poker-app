import type { Card } from '../../engine/deck';
import type { GameState, NewHandConfig, Difficulty } from '../../engine/game';
import { nextButton, rebuy } from '../../engine/game';

export const BUY_IN_BB = 100;

export interface SessionConfig {
  cpuCount: number;
  cpuDifficulty: Difficulty;
  blinds: { sb: number; bb: number };
}

export function initialHandConfig(config: SessionConfig, deck: Card[]): NewHandConfig {
  const buyIn = BUY_IN_BB * config.blinds.bb;
  return {
    players: Array.from({ length: config.cpuCount + 1 }, (_, seat) => ({
      seat,
      stack: buyIn,
      isCpu: seat !== 0,
      ...(seat !== 0 ? { difficulty: config.cpuDifficulty } : {}),
    })),
    button: 0,
    blinds: config.blinds,
    handNumber: 1,
    deck,
  };
}

export function settleBetweenHands(state: GameState): { state: GameState; humanBusted: boolean } {
  const buyIn = BUY_IN_BB * state.blinds.bb;
  let s = state;
  for (const p of state.players) {
    if (p.isCpu && p.stack === 0) s = rebuy(s, p.seat, buyIn);
  }
  const human = s.players.find((p) => !p.isCpu)!;
  return { state: s, humanBusted: human.stack === 0 };
}

export function nextHandConfig(state: GameState, deck: Card[]): NewHandConfig {
  return {
    players: state.players.map((p) => ({
      seat: p.seat,
      stack: p.stack,
      isCpu: p.isCpu,
      ...(p.difficulty ? { difficulty: p.difficulty } : {}),
    })),
    button: nextButton(state),
    blinds: state.blinds,
    handNumber: state.handNumber + 1,
    deck,
  };
}

export function humanRebuy(state: GameState): GameState {
  const buyIn = BUY_IN_BB * state.blinds.bb;
  const human = state.players.find((p) => !p.isCpu)!;
  const amount = Math.max(0, buyIn - human.stack);
  if (amount === 0) return state;
  return rebuy(state, human.seat, amount);
}
