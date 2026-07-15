import { useEffect, useReducer } from 'react';
import { createDeck, shuffle } from '../../engine/deck';
import type { Rng } from '../../engine/rng';
import type { Action, GameState } from '../../engine/game';
import { applyAction, newHand } from '../../engine/game';
import { decideAction } from '../../cpu/strategy';
import {
  initialHandConfig, nextHandConfig, settleBetweenHands, humanRebuy,
  type SessionConfig,
} from './session';

const rng: Rng = Math.random;

export interface TableState {
  game: GameState | null;
  humanBusted: boolean;
}

type TableEvent =
  | { type: 'start'; config: SessionConfig }
  | { type: 'humanAction'; action: Action }
  | { type: 'cpuAction'; action: Action }
  | { type: 'nextHand' }
  | { type: 'humanRebuyAndNext' }
  | { type: 'exit' };

function reducer(state: TableState, ev: TableEvent): TableState {
  switch (ev.type) {
    case 'start':
      return { game: newHand(initialHandConfig(ev.config, shuffle(createDeck(), rng))), humanBusted: false };
    case 'humanAction':
    case 'cpuAction': {
      if (!state.game || state.game.street === 'handOver') return state;
      let game: GameState;
      try {
        game = applyAction(state.game, ev.action);
      } catch (err) {
        console.error(err); // spec §10：engine 錯誤記 console、忽略該動作、牌局不中斷
        return state;
      }
      if (game.street === 'handOver') {
        const settled = settleBetweenHands(game);
        return { game: settled.state, humanBusted: settled.humanBusted };
      }
      return { ...state, game };
    }
    case 'nextHand': {
      if (!state.game || state.game.street !== 'handOver' || state.humanBusted) return state;
      return { game: newHand(nextHandConfig(state.game, shuffle(createDeck(), rng))), humanBusted: false };
    }
    case 'humanRebuyAndNext': {
      if (!state.game || !state.humanBusted) return state;
      const g = humanRebuy(state.game);
      return { game: newHand(nextHandConfig(g, shuffle(createDeck(), rng))), humanBusted: false };
    }
    case 'exit':
      return { game: null, humanBusted: false };
  }
}

// CPU 思考延遲（spec §6：0.5–1.5 秒，UI 層負責）
// e2e 用 ?fastCpu=1 縮短為 50ms，避免煙霧測試等待逼近 timeout
const FAST_CPU = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('fastCpu');

export function useTable() {
  const [state, dispatch] = useReducer(reducer, { game: null, humanBusted: false });
  const game = state.game;

  useEffect(() => {
    if (!game || game.street === 'handOver' || game.toAct === null) return;
    const actor = game.players.find((p) => p.seat === game.toAct)!;
    if (!actor.isCpu) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'cpuAction', action: decideAction(game, actor.seat, actor.difficulty!, rng) });
    }, FAST_CPU ? 50 : 500 + rng() * 1000);
    return () => clearTimeout(timer);
  }, [game]);

  return { state, dispatch };
}
