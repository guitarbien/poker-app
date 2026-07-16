import { describe, it, expect, vi } from 'vitest';
import type { KVStore } from '../storage/storage';
import { parseCard } from '../engine/deck';
import {
  buildHandRecord, appendHand, loadHands,
  HANDS_LIMIT, HANDS_KEY, HANDS_VERSION,
  type HandLog,
} from './recorder';
import type { GameState } from '../engine/game';
import type { Card } from '../engine/deck';

// ── 測試用工廠 ────────────────────────────────────────────────

function memStore(init: Record<string, string> = {}): KVStore {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

// Card = number (0-51)；As=51, Ks=47, 2h=5, 3c=4, Ts=35
const HOLE: [Card, Card] = [parseCard('As'), parseCard('Ks')];
const CPU_HOLE: [Card, Card] = [parseCard('2h'), parseCard('3c')];

function makeHandLog(overrides: Partial<HandLog> = {}): HandLog {
  return {
    startPlayers: [
      { seat: 0, stack: 200, hole: HOLE, isCpu: false },
      { seat: 1, stack: 200, hole: CPU_HOLE, isCpu: true },
    ],
    blinds: { sb: 1, bb: 2 },
    button: 0,
    handNumber: 1,
    entries: [],
    ...overrides,
  };
}

function makeFinalState(humanStack: number): GameState {
  return {
    players: [
      { seat: 0, stack: humanStack, hole: HOLE, state: 'active', committed: 0, totalCommitted: 0, actedThisRound: false, isCpu: false },
      { seat: 1, stack: 400 - humanStack, hole: CPU_HOLE, state: 'active', committed: 0, totalCommitted: 0, actedThisRound: false, isCpu: true },
    ],
    button: 0,
    street: 'handOver',
    board: [parseCard('Ts'), parseCard('Jh'), parseCard('Qd')],
    deck: [],
    pots: [],
    toAct: null,
    currentBet: 0,
    minRaise: 2,
    blinds: { sb: 1, bb: 2 },
    handNumber: 1,
    result: [{ potIndex: 0, winners: [{ seat: 0, amount: 400, handRank: 9999 }] }],
  };
}

// ── buildHandRecord ───────────────────────────────────────────

describe('buildHandRecord', () => {
  it('version = 1', () => {
    expect(buildHandRecord(makeHandLog(), makeFinalState(200), 0).version).toBe(1);
  });

  it('handNumber, timestamp, blinds, button 正確', () => {
    const r = buildHandRecord(makeHandLog({ handNumber: 7, button: 1 }), makeFinalState(200), 9999);
    expect(r.handNumber).toBe(7);
    expect(r.timestamp).toBe(9999);
    expect(r.blinds).toEqual({ sb: 1, bb: 2 });
    expect(r.button).toBe(1);
  });

  it('players = log.startPlayers', () => {
    const log = makeHandLog();
    expect(buildHandRecord(log, makeFinalState(200), 0).players).toEqual(log.startPlayers);
  });

  it('actions = log.entries', () => {
    const entries = [{ seat: 0, street: 'preflop', action: { type: 'fold' as const }, potAfter: 3 }];
    expect(buildHandRecord(makeHandLog({ entries }), makeFinalState(200), 0).actions).toEqual(entries);
  });

  it('board = final.board', () => {
    const r = buildHandRecord(makeHandLog(), makeFinalState(200), 0);
    expect(r.board).toHaveLength(3);
    expect(r.board[0]).toBe(parseCard('Ts'));
  });

  it('potResults = final.result', () => {
    const r = buildHandRecord(makeHandLog(), makeFinalState(200), 0);
    expect(r.potResults).toEqual([{ potIndex: 0, winners: [{ seat: 0, amount: 400, handRank: 9999 }] }]);
  });

  it('humanNet 正值（贏牌）', () => {
    // startPlayers[0].stack = 200，final = 350
    expect(buildHandRecord(makeHandLog(), makeFinalState(350), 0).humanNet).toBe(150);
  });

  it('humanNet 負值（輸牌）', () => {
    expect(buildHandRecord(makeHandLog(), makeFinalState(50), 0).humanNet).toBe(-150);
  });

  it('flags = []', () => {
    expect(buildHandRecord(makeHandLog(), makeFinalState(200), 0).flags).toEqual([]);
  });
});

// ── loadHands / appendHand ────────────────────────────────────

describe('loadHands', () => {
  it('空 store 回傳 []', () => {
    expect(loadHands(memStore())).toEqual([]);
  });

  it('版本不符回傳 []', () => {
    const rec = buildHandRecord(makeHandLog(), makeFinalState(200), 0);
    const s = memStore({ [HANDS_KEY]: JSON.stringify({ version: 0, data: [rec] }) });
    expect(loadHands(s)).toEqual([]);
  });

  it('讀回已存資料', () => {
    const s = memStore();
    appendHand(buildHandRecord(makeHandLog(), makeFinalState(200), 1), s);
    expect(loadHands(s)).toHaveLength(1);
    expect(loadHands(s)[0].handNumber).toBe(1);
  });
});

describe('appendHand 環形緩衝', () => {
  it(`寫入 ${HANDS_LIMIT + 2} 筆後長度維持 ${HANDS_LIMIT} 且最舊被淘汰`, () => {
    const s = memStore();
    for (let i = 1; i <= HANDS_LIMIT + 2; i++) {
      appendHand(buildHandRecord(makeHandLog({ handNumber: i }), makeFinalState(200), i), s);
    }
    const hands = loadHands(s);
    expect(hands).toHaveLength(HANDS_LIMIT);
    // 最舊兩筆（handNumber 1, 2）被淘汰
    expect(hands[0].handNumber).toBe(3);
    expect(hands[HANDS_LIMIT - 1].handNumber).toBe(HANDS_LIMIT + 2);
  });
});

describe('appendHand quota 砍半重試', () => {
  it('setItem 第一次失敗 → 砍半後重試一次成功', () => {
    const s = memStore();
    for (let i = 1; i <= 100; i++) {
      appendHand(buildHandRecord(makeHandLog({ handNumber: i }), makeFinalState(200), i), s);
    }

    let callCount = 0;
    const origSetItem = s.setItem.bind(s);
    s.setItem = vi.fn((k: string, v: string) => {
      callCount++;
      if (callCount === 1) throw new Error('QuotaExceededError');
      origSetItem(k, v);
    });

    appendHand(buildHandRecord(makeHandLog({ handNumber: 101 }), makeFinalState(200), 101), s);

    const hands = loadHands(s);
    expect(hands.length).toBeGreaterThan(0);
    expect(hands.length).toBeLessThan(101);
    expect(hands[hands.length - 1].handNumber).toBe(101); // 最新的在
  });

  it('quota 時 setItem 兩次都失敗 → 不崩潰', () => {
    const s = memStore();
    s.setItem = vi.fn(() => { throw new Error('QuotaExceededError'); });
    expect(() => appendHand(buildHandRecord(makeHandLog(), makeFinalState(200), 0), s)).not.toThrow();
  });
});

// ── 常數 ──────────────────────────────────────────────────────

describe('常數', () => {
  it(`HANDS_LIMIT = 500`, () => expect(HANDS_LIMIT).toBe(500));
  it(`HANDS_VERSION = 1`, () => expect(HANDS_VERSION).toBe(1));
  it(`HANDS_KEY = 'holdem.hands'`, () => expect(HANDS_KEY).toBe('holdem.hands'));
});
