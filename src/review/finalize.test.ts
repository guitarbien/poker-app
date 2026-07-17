import { describe, it, expect } from 'vitest';
import { parseCard } from '../engine/deck';
import type { Card } from '../engine/deck';
import { mulberry32 } from '../engine/rng';
import type { Action } from '../engine/game';
import { newHand, applyAction } from '../engine/game';
import type { HandLog } from './recorder';
import { accumulate, EMPTY_AGGREGATES } from './grader';
import { finalizeHand } from './finalize';

// ── 測試輔助 ──────────────────────────────────────────────────────

const c2 = (a: string, b: string): [Card, Card] => [parseCard(a), parseCard(b)];

interface RigSpec {
  seats: { seat: number; stack: number; isCpu: boolean; hole: [Card, Card] }[];
  button: number;
  blinds?: { sb: number; bb: number };
  board?: Card[];
  handNumber?: number;
}

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
  const rest: Card[] = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
  return [...holes, ...board, ...rest];
}

// 回傳 { log, final } 供 finalizeHand 測試
function playHandSplit(spec: RigSpec, actions: Action[]) {
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
  if (state.street !== 'handOver') throw new Error(`playHandSplit: 未打完 (${state.street})`);
  return { log, final: state };
}

// 6-max: button=5 → seat2=UTG，seat5=BTN，seat0=SB，seat1=BB
function sixMax(humanSeat: number, humanHole: [Card, Card]): RigSpec {
  const defaults: Array<{ seat: number; isCpu: boolean; hole: [Card, Card] }> = [
    { seat: 0, isCpu: true,  hole: c2('Tc', '9c') },
    { seat: 1, isCpu: true,  hole: c2('4c', '5c') },
    { seat: 2, isCpu: true,  hole: c2('7s', '2d') },
    { seat: 3, isCpu: true,  hole: c2('6c', '8c') },
    { seat: 4, isCpu: true,  hole: c2('Jc', 'Td') },
    { seat: 5, isCpu: true,  hole: c2('Qc', 'Kd') },
  ];
  return {
    seats: defaults.map((d) => ({
      seat: d.seat,
      stack: 200,
      isCpu: d.seat !== humanSeat,
      hole: d.seat === humanSeat ? humanHole : d.hole,
    })),
    button: 5,
  };
}

const FOLD5 = Array<Action>(5).fill({ type: 'fold' });

// ── 整合測試 ─────────────────────────────────────────────────────

// ① UTG 72o open raise → record.flags 帶 preflop-loose
describe('finalizeHand 整合：UTG 72o raise → preflop-loose in record.flags', () => {
  const spec = sixMax(2, c2('7s', '2d'));
  const { log, final } = playHandSplit(spec, [
    { type: 'raise', to: 6 },
    ...FOLD5,
  ]);
  const { record, gradeResult } = finalizeHand(log, final, 12345, mulberry32(42));

  it('record.flags 含 preflop-loose', () => {
    expect(record.flags).toHaveLength(1);
    expect(record.flags[0].kind).toBe('preflop-loose');
  });

  it('gradeResult.flags 與 record.flags 相同', () => {
    expect(gradeResult.flags).toEqual(record.flags);
  });

  it('gradeResult.opportunities.rfi = 1', () => {
    expect(gradeResult.opportunities.rfi).toBe(1);
  });

  it('record.timestamp = 12345', () => {
    expect(record.timestamp).toBe(12345);
  });
});

// ② 好手牌（AJo raise）→ record.flags = []
describe('finalizeHand 整合：UTG AJo raise → 無 flag', () => {
  const spec = sixMax(2, c2('Ah', 'Jd'));
  const { log, final } = playHandSplit(spec, [
    { type: 'raise', to: 6 },
    ...FOLD5,
  ]);
  const { record, gradeResult } = finalizeHand(log, final, 0, mulberry32(42));

  it('record.flags = []', () => {
    expect(record.flags).toHaveLength(0);
  });

  it('gradeResult.opportunities.rfi = 1', () => {
    expect(gradeResult.opportunities.rfi).toBe(1);
  });
});

// ③ accumulate 流程：兩手累計後 aggregates 正確
describe('finalizeHand + accumulate：兩手後弱點彙總正確', () => {
  const rng = mulberry32(42);

  const specLoose = sixMax(2, c2('7s', '2d'));
  const loose = playHandSplit(specLoose, [{ type: 'raise', to: 6 }, ...FOLD5]);
  const { gradeResult: gr1 } = finalizeHand(loose.log, loose.final, 1, rng);

  // 這手輸入新的 rng seed 避免共用狀態
  const specTight = sixMax(2, c2('Ah', 'As'));
  const tight = playHandSplit(specTight, [
    { type: 'fold' },
    { type: 'fold' }, { type: 'fold' }, { type: 'fold' }, { type: 'fold' },
  ]);
  const { gradeResult: gr2 } = finalizeHand(tight.log, tight.final, 2, mulberry32(99));

  it('第一手：preflop-loose flag，rfi=1', () => {
    expect(gr1.flags[0].kind).toBe('preflop-loose');
    expect(gr1.opportunities.rfi).toBe(1);
  });

  it('第二手：preflop-tight flag，rfi=1', () => {
    expect(gr2.flags[0].kind).toBe('preflop-tight');
    expect(gr2.opportunities.rfi).toBe(1);
  });

  it('accumulate 兩手後 loose.count=1, tight.count=1, 共用 rfi opportunities=2', () => {
    const agg = accumulate(accumulate(EMPTY_AGGREGATES, gr1), gr2);
    expect(agg['preflop-loose'].count).toBe(1);
    expect(agg['preflop-loose'].opportunities).toBe(2);
    expect(agg['preflop-tight'].count).toBe(1);
    expect(agg['preflop-tight'].opportunities).toBe(2);
    expect(agg['call-without-odds'].count).toBe(0);
  });
});
