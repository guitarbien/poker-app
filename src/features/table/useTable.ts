import { useEffect, useReducer } from 'react';
import { createDeck, shuffle } from '../../engine/deck';
import type { Card } from '../../engine/deck';
import type { Rng } from '../../engine/rng';
import type { Action, GameState } from '../../engine/game';
import { applyAction, newHand } from '../../engine/game';
import { decideAction } from '../../cpu/strategy';
import {
  BUY_IN_BB, initialHandConfig, nextHandConfig, settleBetweenHands, humanRebuy,
  type SessionConfig,
} from './session';

const rng: Rng = Math.random;

export interface TableState {
  game: GameState | null;
  humanBusted: boolean;
}

// deck は呼び出し側が shuffle 済みのものを渡す（reducer 純化）
type TableEvent =
  | { type: 'start'; config: SessionConfig; deck: Card[] }
  | { type: 'humanAction'; action: Action }
  | { type: 'cpuAction'; action: Action }
  | { type: 'nextHand'; deck: Card[] }
  | { type: 'humanRebuyAndNext'; deck: Card[] }
  | { type: 'exit' };

function reducer(state: TableState, ev: TableEvent): TableState {
  switch (ev.type) {
    case 'start':
      return { game: newHand(initialHandConfig(ev.config, ev.deck)), humanBusted: false };
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
      return { game: newHand(nextHandConfig(state.game, ev.deck)), humanBusted: false };
    }
    case 'humanRebuyAndNext': {
      if (!state.game || state.game.street !== 'handOver') return state;
      const human = state.game.players.find((p) => !p.isCpu)!;
      const buyIn = BUY_IN_BB * state.game.blinds.bb;
      if (human.stack >= buyIn) return state;
      const g = humanRebuy(state.game);
      return { game: newHand(nextHandConfig(g, ev.deck)), humanBusted: false };
    }
    case 'exit':
      return { game: null, humanBusted: false };
  }
}

// CPU 思考延遲（spec §6：0.5–1.5 秒，UI 層負責）
// e2e 用 ?fastCpu=1 縮短為 50ms，避免煙霧測試等待逼近 timeout
const FAST_CPU = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('fastCpu');

export interface TableApi {
  state: TableState;
  start: (config: SessionConfig) => void;      // 內部洗牌後 dispatch
  act: (action: Action) => void;               // humanAction
  nextHand: () => void;
  rebuyAndNext: () => void;                    // 破產重買「與」手間補碼共用
  exit: () => void;
}

export function useTable(): TableApi {
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

  return {
    state,
    start: (config: SessionConfig) => dispatch({ type: 'start', config, deck: shuffle(createDeck(), rng) }),
    act: (action: Action) => dispatch({ type: 'humanAction', action }),
    nextHand: () => dispatch({ type: 'nextHand', deck: shuffle(createDeck(), rng) }),
    rebuyAndNext: () => dispatch({ type: 'humanRebuyAndNext', deck: shuffle(createDeck(), rng) }),
    exit: () => dispatch({ type: 'exit' }),
  };
}
