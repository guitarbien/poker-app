import { useEffect, useReducer, useRef } from 'react';
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
import { buildHandRecord, appendHand, type HandLog } from '../../review/recorder';

const rng: Rng = Math.random;

export interface TableState {
  game: GameState | null;
  humanBusted: boolean;
  handLog: HandLog | null;
}

// deck は呼び出し側が shuffle 済みのものを渡す（reducer 純化）
type TableEvent =
  | { type: 'start'; config: SessionConfig; deck: Card[] }
  | { type: 'humanAction'; action: Action }
  | { type: 'cpuAction'; action: Action }
  | { type: 'nextHand'; deck: Card[] }
  | { type: 'humanRebuyAndNext'; deck: Card[] }
  | { type: 'exit' };

function makeHandLog(config: ReturnType<typeof initialHandConfig>, game: GameState): HandLog {
  return {
    startPlayers: config.players.map((cp) => ({
      seat: cp.seat,
      stack: cp.stack, // 貼盲前
      hole: game.players.find((p) => p.seat === cp.seat)!.hole as [Card, Card],
      isCpu: cp.isCpu,
    })),
    blinds: config.blinds,
    button: config.button,
    handNumber: config.handNumber,
    entries: [],
  };
}

// export 供測試（reducer 是純函式）
export function reducer(state: TableState, ev: TableEvent): TableState {
  switch (ev.type) {
    case 'start': {
      const config = initialHandConfig(ev.config, ev.deck);
      const game = newHand(config);
      return { game, humanBusted: false, handLog: makeHandLog(config, game) };
    }
    case 'humanAction':
    case 'cpuAction': {
      if (!state.game || state.game.street === 'handOver') return state;
      const { toAct, street } = state.game;
      let game: GameState;
      try {
        game = applyAction(state.game, ev.action);
      } catch (err) {
        console.error(err); // spec §10：engine 錯誤記 console、忽略該動作、牌局不中斷
        return state;
      }
      // potAfter = Σ totalCommitted（行動後的 state）
      const potAfter = game.players.reduce((sum, p) => sum + p.totalCommitted, 0);
      const entry = { seat: toAct!, street, action: ev.action, potAfter };
      // immutable append：禁止 mutation push（StrictMode 防重複記錄）
      const handLog = state.handLog
        ? { ...state.handLog, entries: [...state.handLog.entries, entry] }
        : null;

      if (game.street === 'handOver') {
        const settled = settleBetweenHands(game);
        return { game: settled.state, humanBusted: settled.humanBusted, handLog };
      }
      return { ...state, game, handLog };
    }
    case 'nextHand': {
      if (!state.game || state.game.street !== 'handOver' || state.humanBusted) return state;
      const config = nextHandConfig(state.game, ev.deck);
      const game = newHand(config);
      return { game, humanBusted: false, handLog: makeHandLog(config, game) };
    }
    case 'humanRebuyAndNext': {
      if (!state.game || state.game.street !== 'handOver') return state;
      const human = state.game.players.find((p) => !p.isCpu)!;
      const buyIn = BUY_IN_BB * state.game.blinds.bb;
      if (human.stack >= buyIn) return state;
      const g = humanRebuy(state.game);
      const config = nextHandConfig(g, ev.deck);
      const game = newHand(config);
      return { game, humanBusted: false, handLog: makeHandLog(config, game) };
    }
    case 'exit':
      return { game: null, humanBusted: false, handLog: null };
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
  const [state, dispatch] = useReducer(reducer, { game: null, humanBusted: false, handLog: null });
  const game = state.game;

  // 防重 ref：記「已持久化的 handLog 物件參考」，比對參考不等才寫入
  const persistedLogRef = useRef<HandLog | null>(null);

  // CPU 自動行動
  useEffect(() => {
    if (!game || game.street === 'handOver' || game.toAct === null) return;
    const actor = game.players.find((p) => p.seat === game.toAct)!;
    if (!actor.isCpu) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'cpuAction', action: decideAction(game, actor.seat, actor.difficulty!, rng) });
    }, FAST_CPU ? 50 : 500 + rng() * 1000);
    return () => clearTimeout(timer);
  }, [game]);

  // handOver 時持久化（防重：同一 handLog 物件參考只寫一次）
  useEffect(() => {
    if (!game || game.street !== 'handOver') return;
    if (!state.handLog) return;
    if (persistedLogRef.current === state.handLog) return;
    persistedLogRef.current = state.handLog;
    const record = buildHandRecord(state.handLog, game, Date.now());
    appendHand(record);
    // Task 5: recordHand(record)
  }, [game, state.handLog]);

  return {
    state,
    start: (config: SessionConfig) => {
      persistedLogRef.current = null;
      dispatch({ type: 'start', config, deck: shuffle(createDeck(), rng) });
    },
    act: (action: Action) => dispatch({ type: 'humanAction', action }),
    nextHand: () => dispatch({ type: 'nextHand', deck: shuffle(createDeck(), rng) }),
    rebuyAndNext: () => dispatch({ type: 'humanRebuyAndNext', deck: shuffle(createDeck(), rng) }),
    exit: () => {
      persistedLogRef.current = null;
      dispatch({ type: 'exit' });
    },
  };
}
