import { describe, it, expect } from 'vitest';
import { cards, parseCard } from '../engine/deck';
import type { Card } from '../engine/deck';
import { replayDeck, replayStates } from './replay';
import type { Action, GameState } from '../engine/game';
import { newHand, applyAction } from '../engine/game';
import { buildHandRecord, type HandLog, type HandRecord } from './recorder';

const c2 = (a: string, b: string): [Card, Card] => [parseCard(a), parseCard(b)];

// ── Test Helper: 以 rigged deck 實打一手牌並比照 useTable 的記錄方式產出 HandRecord ──

interface RigSpec {
  // seat 升冪；hole 為發給該座位的兩張牌
  seats: { seat: number; stack: number; isCpu: boolean; hole: [Card, Card] }[];
  button: number;
  blinds?: { sb: number; bb: number };
  board?: Card[]; // 依發牌順序的公共牌（flop×3, turn, river 的前綴亦可）
  handNumber?: number;
}

// 與 replayDeck 同構：hole 依發牌序（button+1 起）展平 → board → 其餘
function rigDeck(spec: RigSpec): Card[] {
  const { seats, button } = spec;
  const buttonIdx = seats.findIndex((p) => p.seat === button);
  const holes: Card[] = [];
  for (let n = 0; n < seats.length; n++) {
    const p = seats[(buttonIdx + n + 1) % seats.length];
    holes.push(p.hole[0], p.hole[1]);
  }
  const board = spec.board ?? [];
  const used = new Set<Card>([...holes, ...board]);
  if (used.size !== holes.length + board.length) throw new Error('rigDeck: 牌重複');
  const rest: Card[] = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
  return [...holes, ...board, ...rest];
}

function playHand(
  spec: RigSpec,
  actions: Action[],
): { record: HandRecord; final: GameState } {
  const blinds = spec.blinds ?? { sb: 1, bb: 2 };
  const handNumber = spec.handNumber ?? 1;
  let state = newHand({
    players: spec.seats.map((p) => ({ seat: p.seat, stack: p.stack, isCpu: p.isCpu })),
    button: spec.button,
    blinds,
    handNumber,
    deck: rigDeck(spec),
  });
  const log: HandLog = {
    startPlayers: spec.seats.map((p) => ({
      seat: p.seat, stack: p.stack, hole: p.hole, isCpu: p.isCpu,
    })),
    blinds,
    button: spec.button,
    handNumber,
    entries: [],
  };
  for (const action of actions) {
    const { toAct, street } = state;
    state = applyAction(state, action);
    const potAfter = state.players.reduce((sum, p) => sum + p.totalCommitted, 0);
    log.entries.push({ seat: toAct!, street, action, potAfter });
  }
  if (state.street !== 'handOver') throw new Error(`playHand: 動作序列未打完整手（${state.street}）`);
  return { record: buildHandRecord(log, state, 12345), final: state };
}

// ── 案例 A：HU 打到攤牌（preflop call/check → 三街過牌 → river bet/call）──

const showdownSpec: RigSpec = {
  seats: [
    { seat: 0, stack: 200, isCpu: false, hole: c2('As', 'Ks') },
    { seat: 1, stack: 200, isCpu: true, hole: c2('Qh', 'Qd') },
  ],
  button: 1,
  board: cards('Ah', '7c', '2d', 'Ts', '3h'),
};

// HU：button=SB 先行動（preflop）；postflop BB（seat 0）先行動
const showdownActions = [
  { type: 'call' as const },            // seat1 SB 補到 2
  { type: 'check' as const },           // seat0 BB
  { type: 'check' as const },           // flop: seat0
  { type: 'check' as const },           // flop: seat1
  { type: 'check' as const },           // turn: seat0
  { type: 'check' as const },           // turn: seat1
  { type: 'raise' as const, to: 4 },    // river: seat0 下注 4
  { type: 'call' as const },            // river: seat1 跟注 → 攤牌
];

// ── 案例 B：3-max 翻牌前棄牌提前結束 ────────────────────────────

const foldSpec: RigSpec = {
  seats: [
    { seat: 0, stack: 200, isCpu: false, hole: c2('9c', '8c') },
    { seat: 1, stack: 150, isCpu: true, hole: c2('2h', '3d') },
    { seat: 2, stack: 300, isCpu: true, hole: c2('Kd', 'Jh') },
  ],
  button: 2,
  board: [],
};

// 3-max：BTN(2) 先行動 → SB(0) raise → BB(1) fold、BTN 已棄 → 結束
const foldActions = [
  { type: 'fold' as const },            // seat2 BTN
  { type: 'raise' as const, to: 6 },    // seat0 SB
  { type: 'fold' as const },            // seat1 BB → handOver
];

// ── 案例 C：HU preflop all-in run-out ────────────────────────────

const allinRunOutSpec: RigSpec = {
  seats: [
    { seat: 0, stack: 100, isCpu: false, hole: c2('As', 'Ks') },
    { seat: 1, stack: 100, isCpu: true, hole: c2('2h', '3d') },
  ],
  button: 1,
  board: cards('Ah', '7c', '2d', 'Ts', '3h'),
};

// HU：BTN(1) raise all-in → SB(0) call → 引擎自動 run-out board
const allinRunOutActions = [
  { type: 'raise' as const, to: 100 },  // seat1 BTN raise all-in
  { type: 'call' as const },            // seat0 SB call all-in
];

describe('replayDeck', () => {
  it('deck 為 52 張不重複，hole 依發牌序展平、board 接續其後', () => {
    const { record } = playHand(showdownSpec, showdownActions);
    const deck = replayDeck(record);
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
    // button=1（HU）→ seat0 先發：deck[0..1]=seat0 hole, deck[2..3]=seat1 hole
    expect(deck.slice(0, 2)).toEqual(record.players[0].hole);
    expect(deck.slice(2, 4)).toEqual(record.players[1].hole);
    expect(deck.slice(4, 9)).toEqual(record.board);
  });
});

describe('replayStates（攤牌案例）', () => {
  const { record, final } = playHand(showdownSpec, showdownActions);
  const states = replayStates(record);

  it('states 長度 = actions.length + 1', () => {
    expect(states).toHaveLength(record.actions.length + 1);
  });

  it('states[0] 各家 hole 與 record 相同', () => {
    for (const p of record.players) {
      expect(states[0].players.find((x) => x.seat === p.seat)!.hole).toEqual(p.hole);
    }
  });

  it('每步 potAfter 與 record 相同（Σ totalCommitted 驗）', () => {
    record.actions.forEach((entry, i) => {
      const pot = states[i + 1].players.reduce((sum, p) => sum + p.totalCommitted, 0);
      expect(pot).toBe(entry.potAfter);
    });
  });

  it('每步 street 與 record 相同（動作執行前的街道）', () => {
    record.actions.forEach((entry, i) => {
      expect(states[i].street).toBe(entry.street);
    });
  });

  it('終局 board 與 stacks 等於原終局', () => {
    const last = states[states.length - 1];
    expect(last.street).toBe('handOver');
    expect(last.board).toEqual(record.board);
    for (const p of final.players) {
      expect(last.players.find((x) => x.seat === p.seat)!.stack).toBe(p.stack);
    }
    expect(last.result).toEqual(final.result);
  });
});

describe('replayStates（棄牌提前結束案例）', () => {
  const { record, final } = playHand(foldSpec, foldActions);
  const states = replayStates(record);

  it('states[0] 各家 hole 與 record 相同', () => {
    for (const p of record.players) {
      expect(states[0].players.find((x) => x.seat === p.seat)!.hole).toEqual(p.hole);
    }
  });

  it('每步 potAfter 相同、終局 board 為空、stacks 相同', () => {
    record.actions.forEach((entry, i) => {
      const pot = states[i + 1].players.reduce((sum, p) => sum + p.totalCommitted, 0);
      expect(pot).toBe(entry.potAfter);
    });
    const last = states[states.length - 1];
    expect(last.street).toBe('handOver');
    expect(last.board).toEqual([]);
    for (const p of final.players) {
      expect(last.players.find((x) => x.seat === p.seat)!.stack).toBe(p.stack);
    }
  });
});

describe('replayStates（all-in run-out 案例）', () => {
  const { record, final } = playHand(allinRunOutSpec, allinRunOutActions);
  const states = replayStates(record);

  it('states[0] 各家 hole 與 record 相同', () => {
    for (const p of record.players) {
      expect(states[0].players.find((x) => x.seat === p.seat)!.hole).toEqual(p.hole);
    }
  });

  it('終局 board 與 record.board 相同', () => {
    const last = states[states.length - 1];
    expect(last.street).toBe('handOver');
    expect(last.board).toEqual(record.board);
  });

  it('終局 stacks 與原終局相同', () => {
    const last = states[states.length - 1];
    for (const p of final.players) {
      expect(last.players.find((x) => x.seat === p.seat)!.stack).toBe(p.stack);
    }
  });

  it('states 長度 = actions.length + 1', () => {
    expect(states).toHaveLength(record.actions.length + 1);
  });
});
