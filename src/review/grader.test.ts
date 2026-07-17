import { describe, it, expect } from 'vitest';
import { cards, parseCard } from '../engine/deck';
import type { Card } from '../engine/deck';
import { mulberry32 } from '../engine/rng';
import type { Action } from '../engine/game';
import { newHand, applyAction } from '../engine/game';
import { buildHandRecord, type HandLog, type HandRecord } from './recorder';
import { gradeHand, accumulate, EMPTY_AGGREGATES } from './grader';

// ── Test helpers ──────────────────────────────────────────────────

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
  if (used.size !== holes.length + board.length) throw new Error('rigDeck: 牌重複');
  const rest: Card[] = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
  return [...holes, ...board, ...rest];
}

function playHand(spec: RigSpec, actions: Action[]): HandRecord {
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
  if (state.street !== 'handOver') throw new Error(`playHand: 未打完整手 (${state.street})`);
  return buildHandRecord(log, state, 12345);
}

// 6-max: button=5 → seat5=BTN, seat0=SB, seat1=BB, seat2=UTG, seat3=MP, seat4=CO
// 翻牌前行動順序: seat2 → seat3 → seat4 → seat5 → seat0 → seat1
// ponytail: factory 讓每個 spec 都是新的 plain object，無 readonly 問題
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

// 6-max preflop fold-all helper: human opens or folds, rest fold/let BB win
// actions: [humanAction, fold×(n-1)]
const FOLD5 = Array<Action>(5).fill({ type: 'fold' });

// ── ① UTG 72o open raise → preflop-loose ─────────────────────────
describe('錨點① UTG 72o open raise → preflop-loose', () => {
  // 72o 不在 UTG RFI range
  const record = playHand(sixMax(2, c2('7s', '2d')), [
    { type: 'raise', to: 6 }, // seat2 human UTG raises
    ...FOLD5,                  // seat3..seat1 all fold
  ]);
  const result = gradeHand(record, mulberry32(42));

  it('產生一個 preflop-loose flag', () => {
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].kind).toBe('preflop-loose');
    expect(result.flags[0].actionIndex).toBe(0);
  });

  it('rfi opportunity = 1', () => {
    expect(result.opportunities.rfi).toBe(1);
  });
});

// ── ② UTG AA fold → preflop-tight ────────────────────────────────
describe('錨點② UTG AA fold → preflop-tight', () => {
  // AA 在 UTG range，但 human fold → preflop-tight
  const record = playHand(sixMax(2, c2('Ah', 'As')), [
    { type: 'fold' }, // seat2 human folds AA
    { type: 'fold' }, // seat3
    { type: 'fold' }, // seat4
    { type: 'fold' }, // seat5
    { type: 'fold' }, // seat0 SB → BB(seat1) wins
  ]);
  const result = gradeHand(record, mulberry32(42));

  it('產生一個 preflop-tight flag', () => {
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].kind).toBe('preflop-tight');
  });

  it('rfi opportunity = 1', () => {
    expect(result.opportunities.rfi).toBe(1);
  });
});

// ── ③ UTG AJo open → 無 flag，rfi opportunity+1 ──────────────────
describe('錨點③ UTG AJo open → 無 flag，rfi opportunity+1', () => {
  // AJo 在 UTG range，open raise → standard（不標記）
  const record = playHand(sixMax(2, c2('Ah', 'Jd')), [
    { type: 'raise', to: 6 },
    ...FOLD5,
  ]);
  const result = gradeHand(record, mulberry32(42));

  it('沒有 flag', () => {
    expect(result.flags).toHaveLength(0);
  });

  it('rfi opportunity = 1', () => {
    expect(result.opportunities.rfi).toBe(1);
  });
});

// ── ③.5 UTG 72o limp → preflop-loose，rfi opportunity+1 ────────────
describe('錨點③.5 UTG 72o limp(call) → preflop-loose，rfi opportunity+1', () => {
  // 72o 不在 UTG range，limp（call）→ preflop-loose
  const record = playHand(sixMax(2, c2('7s', '2d')), [
    { type: 'call' }, // seat2 human UTG limps
    ...FOLD5,         // seat3..seat1 all fold
  ]);
  const result = gradeHand(record, mulberry32(42));

  it('產生一個 preflop-loose flag', () => {
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].kind).toBe('preflop-loose');
    expect(result.flags[0].actionIndex).toBe(0);
  });

  it('rfi opportunity = 1', () => {
    expect(result.opportunities.rfi).toBe(1);
  });
});

// ── ④ human 在 BB 不評分、不計 opportunity ───────────────────────
describe('錨點④ human 在 BB → 不評分、不計 opportunity', () => {
  // human = seat1(BB in 6-max with button=5)
  const record = playHand(sixMax(1, c2('Kh', 'Qd')), [
    { type: 'fold' }, // seat2 UTG
    { type: 'fold' }, // seat3
    { type: 'fold' }, // seat4
    { type: 'fold' }, // seat5
    { type: 'fold' }, // seat0 SB → BB wins（human never acts voluntarily）
  ]);
  const result = gradeHand(record, mulberry32(42));

  it('沒有 flag', () => {
    expect(result.flags).toHaveLength(0);
  });

  it('rfi opportunity = 0', () => {
    expect(result.opportunities.rfi).toBe(0);
  });
});

// ── ⑤ 面對加注後 human call，非 RFI（不評、不計 opportunity）─────
describe('錨點⑤ human 面對 raise 後 call → 非 RFI，不計 opportunity', () => {
  // human = seat4(CO)；CPU seat2(UTG) raises first
  // postflop：seat2(CPU) check，seat4(human) fold
  const record = playHand(sixMax(4, c2('Kh', 'Qd')), [
    { type: 'raise', to: 6 }, // seat2 UTG CPU raises
    { type: 'fold' },          // seat3 MP
    { type: 'call' },          // seat4 CO human calls（有前置 raise，非 RFI）
    { type: 'fold' },          // seat5 BTN
    { type: 'fold' },          // seat0 SB
    { type: 'fold' },          // seat1 BB → HU: seat2 vs seat4
    { type: 'check' },         // seat2 flop（out of position, CPU）
    { type: 'fold' },          // seat4 human folds → handOver
  ]);
  const result = gradeHand(record, mulberry32(42));

  it('沒有 preflop flag', () => {
    const pfFlags = result.flags.filter(
      (f) => f.kind === 'preflop-loose' || f.kind === 'preflop-tight',
    );
    expect(pfFlags).toHaveLength(0);
  });

  it('rfi opportunity = 0', () => {
    expect(result.opportunities.rfi).toBe(0);
  });
});

// ── ⑥ CPU limp 在前，human 決策不評、不計 opportunity ───────────
describe('錨點⑥ CPU limp 在前 → human 不評分、不計 opportunity', () => {
  // human = seat4(CO)；seat2(UTG) CPU limps first，human folds
  // After human folds: seat5 fold, seat0 fold, seat1(BB) check → seat2 vs seat1 see flop
  // Flop: seat1 folds → handOver
  const record = playHand(sixMax(4, c2('Kh', 'Qd')), [
    { type: 'call' },  // seat2 UTG CPU limp
    { type: 'fold' },  // seat3 MP
    { type: 'fold' },  // seat4 CO human folds（limp 在前，非 RFI）
    { type: 'fold' },  // seat5 BTN
    { type: 'fold' },  // seat0 SB
    { type: 'check' }, // seat1 BB checks（limp pot）
    { type: 'fold' },  // seat2 UTG folds flop → handOver
  ]);
  const result = gradeHand(record, mulberry32(42));

  it('沒有 preflop flag', () => {
    const pfFlags = result.flags.filter(
      (f) => f.kind === 'preflop-loose' || f.kind === 'preflop-tight',
    );
    expect(pfFlags).toHaveLength(0);
  });

  it('rfi opportunity = 0', () => {
    expect(result.opportunities.rfi).toBe(0);
  });
});

// ── ⑦⑧ HU postflop odds: human=BB(seat0), CPU=BTN(seat1), button=1
// board = KQJ87（五張）；river: seat0 check → seat1 raises to 4 → seat0 calls
// At call（actionIndex=8）: human.totalCommitted=2, cpu.totalCommitted=6 → pot=8, owe=4
// required = 4/(8+4) = 1/3

const HU_ACTIONS: Action[] = [
  { type: 'call' },          // seat1 preflop call（SB/BTN completes）
  { type: 'check' },         // seat0 preflop check（BB）
  { type: 'check' },         // seat0 flop（BB acts first postflop）
  { type: 'check' },         // seat1 flop
  { type: 'check' },         // seat0 turn
  { type: 'check' },         // seat1 turn
  { type: 'check' },         // seat0 river check
  { type: 'raise', to: 4 }, // seat1 river bet 4
  { type: 'call' },          // seat0 human river call ← actionIndex=8
];

// ── ⑦ 32o on KQJ87 → call-without-odds（dead hand, estimated≈0.06）─
describe('錨點⑦ river 賠率不足 32o on KQJ87 → call-without-odds', () => {
  const spec: RigSpec = {
    seats: [
      { seat: 0, stack: 200, isCpu: false, hole: c2('3h', '2d') }, // human BB（dead hand）
      { seat: 1, stack: 200, isCpu: true,  hole: c2('Td', 'Ac') }, // CPU BTN/SB
    ],
    button: 1,
    board: cards('Kc', 'Qd', 'Js', '8h', '7c'),
  };
  const record = playHand(spec, HU_ACTIONS);
  const result = gradeHand(record, mulberry32(42));

  it('有一個 call-without-odds flag，actionIndex=8', () => {
    const f = result.flags.find((x) => x.kind === 'call-without-odds');
    expect(f).toBeDefined();
    expect(f!.actionIndex).toBe(8);
  });

  it('requiredEquity ≈ 0.333（1/3）', () => {
    const f = result.flags.find((x) => x.kind === 'call-without-odds');
    expect(f!.detail!.requiredEquity).toBeCloseTo(1 / 3, 2);
  });

  it('estimatedEquity < 0.15（死牌，幾乎無 equity）', () => {
    const f = result.flags.find((x) => x.kind === 'call-without-odds');
    expect(f!.detail!.estimatedEquity!).toBeLessThan(0.15);
  });

  it('postflopCall opportunity = 1', () => {
    expect(result.opportunities.postflopCall).toBe(1);
  });
});

// ── ⑧ AA on KQJ87 → 不標記，postflopCall opportunity+1 ──────────
describe('錨點⑧ 強勢成牌跟注 AhAs on KQJ87 → 不標記，postflopCall+1', () => {
  const spec: RigSpec = {
    seats: [
      { seat: 0, stack: 200, isCpu: false, hole: c2('Ah', 'As') }, // human BB（AA強牌）
      { seat: 1, stack: 200, isCpu: true,  hole: c2('Td', '2c') }, // CPU BTN/SB
    ],
    button: 1,
    board: cards('Kc', 'Qd', 'Js', '8h', '7c'),
  };
  const record = playHand(spec, HU_ACTIONS);
  const result = gradeHand(record, mulberry32(42));

  it('沒有 call-without-odds flag', () => {
    expect(result.flags.filter((f) => f.kind === 'call-without-odds')).toHaveLength(0);
  });

  it('postflopCall opportunity = 1', () => {
    expect(result.opportunities.postflopCall).toBe(1);
  });
});

// ── ⑨.HU short-stack call for less：required 依有效賭注截斷計算 ──
// HU：human=BB(seat0) stack=4（貼盲 2 後剩 2），CPU=BTN(seat1) stack=200
// river CPU 下注 100 → human 只能 all-in call 2
// 有效賠率：pay=2, level=4, pot=min(102,4)+min(2,4)=4+2=6
// required = 2/(6+2) = 0.25；A2o ≈ 0.34 > 0.25 → 不應被標記
describe('錨點⑨ 短籌碼 all-in call for less → required = 0.25，A2o 不標記', () => {
  const spec: RigSpec = {
    seats: [
      { seat: 0, stack: 4,   isCpu: false, hole: c2('Ah', '2d') }, // human BB
      { seat: 1, stack: 200, isCpu: true,  hole: c2('Td', '9s') }, // CPU BTN/SB
    ],
    button: 1,
    board: cards('Kc', 'Qd', 'Js', '8h', '7c'),
  };
  const record = playHand(spec, [
    { type: 'call' },           // seat1 SB 補到 2
    { type: 'check' },          // seat0 BB
    { type: 'check' }, { type: 'check' }, // flop
    { type: 'check' }, { type: 'check' }, // turn
    { type: 'check' },           // river seat0
    { type: 'raise', to: 100 }, // river seat1 bet 100
    { type: 'call' },            // seat0 human all-in call for 2
  ]);
  const result = gradeHand(record, mulberry32(42));

  it('requiredEquity ≈ 0.25（2/8）', () => {
    const f = result.flags.find((x) => x.kind === 'call-without-odds');
    // A2o estimated ≈ 0.34 > 0.25 → no flag; if flag exists required must be ≤ 0.25+buffer
    if (f) {
      expect(f.detail!.requiredEquity).toBeCloseTo(0.25, 2);
    } else {
      // 正確路徑：不標記
      expect(result.flags.filter((x) => x.kind === 'call-without-odds')).toHaveLength(0);
    }
  });

  it('用截斷賠率 required=0.25，A2o（estimated≈0.34）不被標記', () => {
    const callFlags = result.flags.filter((x) => x.kind === 'call-without-odds');
    expect(callFlags).toHaveLength(0);
  });

  it('postflopCall opportunity = 1', () => {
    expect(result.opportunities.postflopCall).toBe(1);
  });
});

// ── ⑨ accumulate：preflop-loose 與 preflop-tight 共用 rfi 分母 ───
describe('錨點⑨ accumulate 分子分母，loose/tight 共用 rfi opportunities', () => {
  // Result A: preflop-loose（72o raise at UTG，rfi=1）
  const recordA = playHand(sixMax(2, c2('7s', '2d')), [
    { type: 'raise', to: 6 }, ...FOLD5,
  ]);
  const resultA = gradeHand(recordA, mulberry32(42));

  // Result B: preflop-tight（AA fold at UTG，rfi=1）
  const recordB = playHand(sixMax(2, c2('Ah', 'As')), [
    { type: 'fold' },
    { type: 'fold' }, { type: 'fold' }, { type: 'fold' }, { type: 'fold' },
  ]);
  const resultB = gradeHand(recordB, mulberry32(42));

  it('resultA: preflop-loose flag，rfi=1', () => {
    expect(resultA.flags[0].kind).toBe('preflop-loose');
    expect(resultA.opportunities.rfi).toBe(1);
  });

  it('resultB: preflop-tight flag，rfi=1', () => {
    expect(resultB.flags[0].kind).toBe('preflop-tight');
    expect(resultB.opportunities.rfi).toBe(1);
  });

  it('accumulate 後 loose 和 tight 的 opportunities 都 = 2（共用 rfi）', () => {
    const step1 = accumulate(EMPTY_AGGREGATES, resultA);
    const step2 = accumulate(step1, resultB);

    expect(step2['preflop-loose'].count).toBe(1);
    expect(step2['preflop-loose'].opportunities).toBe(2);

    expect(step2['preflop-tight'].count).toBe(1);
    expect(step2['preflop-tight'].opportunities).toBe(2);

    expect(step2['call-without-odds'].count).toBe(0);
    expect(step2['call-without-odds'].opportunities).toBe(0);
  });
});
