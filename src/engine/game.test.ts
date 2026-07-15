import { describe, it, expect } from 'vitest';
import { createDeck } from './deck';
import { newHand, positionOf, nextButton, legalActions, applyAction, type NewHandConfig } from './game';

// 測試用固定牌序（未洗牌：0,1,2,...,51）
export function config6(overrides: Partial<NewHandConfig> = {}): NewHandConfig {
  return {
    players: [0, 1, 2, 3, 4, 5].map((seat) => ({ seat, stack: 200, isCpu: seat !== 0 })),
    button: 0,
    blinds: { sb: 1, bb: 2 },
    handNumber: 1,
    deck: createDeck(),
    ...overrides,
  };
}

describe('newHand：6 人桌', () => {
  const state = newHand(config6());

  it('盲注正確：button+1 貼 SB、button+2 貼 BB', () => {
    expect(state.players[1].committed).toBe(1);
    expect(state.players[2].committed).toBe(2);
    expect(state.players[1].stack).toBe(199);
    expect(state.players[2].stack).toBe(198);
    expect(state.currentBet).toBe(2);
    expect(state.minRaise).toBe(2);
  });

  it('preflop 由 BB 下一位（UTG）先行動', () => {
    expect(state.toAct).toBe(3);
  });

  it('每人 2 張手牌、牌堆剩 40 張、board 空', () => {
    for (const p of state.players) expect(p.hole).toHaveLength(2);
    expect(state.deck).toHaveLength(52 - 12);
    expect(state.board).toHaveLength(0);
    expect(state.street).toBe('preflop');
    expect(state.result).toBeNull();
  });

  it('發出的牌不重複', () => {
    const dealt = state.players.flatMap((p) => p.hole!);
    expect(new Set([...dealt, ...state.deck]).size).toBe(52);
  });
});

describe('newHand：heads-up', () => {
  const state = newHand(config6({
    players: [0, 1].map((seat) => ({ seat, stack: 200, isCpu: seat !== 0 })),
    button: 0,
  }));

  it('button 兼 SB、另一人 BB、preflop 由 button 先行動', () => {
    expect(state.players[0].committed).toBe(1);
    expect(state.players[1].committed).toBe(2);
    expect(state.toAct).toBe(0);
  });
});

describe('盲注不足額', () => {
  it('BB 籌碼不足時 all-in', () => {
    const state = newHand(config6({
      players: [
        { seat: 0, stack: 200, isCpu: false },
        { seat: 1, stack: 200, isCpu: true },
        { seat: 2, stack: 1, isCpu: true }, // BB 只有 1
      ],
    }));
    expect(state.players[2].committed).toBe(1);
    expect(state.players[2].stack).toBe(0);
    expect(state.players[2].state).toBe('allin');
    expect(state.currentBet).toBe(2); // currentBet 仍是完整 BB
  });
});

describe('positionOf', () => {
  it('6 人：BTN/SB/BB/UTG/MP/CO', () => {
    const s = newHand(config6());
    expect([0, 1, 2, 3, 4, 5].map((x) => positionOf(s, x)))
      .toEqual(['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO']);
  });

  it('4 人：CO/BTN/SB/BB（spec §5 範例）', () => {
    const s = newHand(config6({
      players: [0, 1, 2, 3].map((seat) => ({ seat, stack: 200, isCpu: seat !== 0 })),
      button: 1,
    }));
    expect([1, 2, 3, 0].map((x) => positionOf(s, x))).toEqual(['BTN', 'SB', 'BB', 'CO']);
  });

  it('2 人：BTN 與 BB', () => {
    const s = newHand(config6({
      players: [0, 1].map((seat) => ({ seat, stack: 200, isCpu: seat !== 0 })),
      button: 1,
    }));
    expect(positionOf(s, 1)).toBe('BTN');
    expect(positionOf(s, 0)).toBe('BB');
  });
});

describe('nextButton', () => {
  it('順時針移到下一個座位', () => {
    const s = newHand(config6({ button: 5 }));
    expect(nextButton(s)).toBe(0);
  });
});

// 依序套用多個動作
function play(state: ReturnType<typeof newHand>, ...actions: Parameters<typeof applyAction>[1][]) {
  return actions.reduce((s, a) => applyAction(s, a), state);
}

describe('legalActions', () => {
  it('面對注：fold/call 可用、check 不可用', () => {
    const s = newHand(config6()); // UTG 面對 BB
    const la = legalActions(s);
    expect(la.fold).toBe(true);
    expect(la.check).toBe(false);
    expect(la.call).toEqual({ amount: 2 });
    expect(la.raise).toEqual({ min: 4, max: 200 }); // min = currentBet 2 + minRaise 2
  });

  it('無人下注時可 check、raise min 為 1 BB', () => {
    // 全跟到 BB、BB check → flop，第一個行動者可 check
    let s = newHand(config6());
    s = play(s,
      { type: 'call' }, { type: 'call' }, { type: 'call' },
      { type: 'call' }, { type: 'call' }, { type: 'check' },
    );
    expect(s.street).toBe('flop');
    const la = legalActions(s);
    expect(la.check).toBe(true);
    expect(la.call).toBeNull();
    expect(la.raise!.min).toBe(2); // 最小下注 1 BB
  });
});

describe('BB option', () => {
  it('全員跟注後 BB 仍可加注，下注圈未結束', () => {
    let s = newHand(config6());
    s = play(s,
      { type: 'call' }, { type: 'call' }, { type: 'call' },
      { type: 'call' }, { type: 'call' },
    );
    expect(s.street).toBe('preflop'); // 還沒進 flop
    expect(s.toAct).toBe(2);          // 輪到 BB
    expect(legalActions(s).raise).not.toBeNull();
    // BB 加注後行動重開
    s = applyAction(s, { type: 'raise', to: 8 });
    expect(s.street).toBe('preflop');
    expect(s.toAct).toBe(3);
  });
});

describe('加注規則', () => {
  it('完整加注更新 minRaise 並重開行動', () => {
    let s = newHand(config6());
    s = applyAction(s, { type: 'raise', to: 6 }); // UTG open 6（增量 4）
    expect(s.currentBet).toBe(6);
    expect(s.minRaise).toBe(4);
    expect(legalActions(s).raise!.min).toBe(10); // 6 + 4
  });

  it('低於最小加注且非 all-in 丟 BELOW_MIN_RAISE', () => {
    const s = newHand(config6());
    expect(() => applyAction(s, { type: 'raise', to: 3 })).toThrowError(/BELOW_MIN_RAISE/);
  });

  it('超過身家丟 BAD_AMOUNT', () => {
    const s = newHand(config6());
    expect(() => applyAction(s, { type: 'raise', to: 999 })).toThrowError(/BAD_AMOUNT/);
  });

  it('不足額 all-in：currentBet 更新、minRaise 不變、已行動者不能再加注', () => {
    let s = newHand(config6({
      players: [
        { seat: 0, stack: 200, isCpu: false },
        { seat: 1, stack: 200, isCpu: true },
        { seat: 2, stack: 200, isCpu: true },
        { seat: 3, stack: 200, isCpu: true },
        { seat: 4, stack: 8, isCpu: true }, // 短籌碼
        { seat: 5, stack: 200, isCpu: true },
      ],
    }));
    s = applyAction(s, { type: 'raise', to: 6 });        // seat3 open 6
    s = applyAction(s, { type: 'raise', to: 8 });        // seat4 all-in 8（不足額：增量 2 < minRaise 4）
    expect(s.currentBet).toBe(8);
    expect(s.minRaise).toBe(4); // 不變
    expect(s.players[4].state).toBe('allin');
    s = play(s, { type: 'fold' }, { type: 'fold' }, { type: 'fold' }, { type: 'fold' }); // seat5, 0, 1, 2
    // 回到 seat3（已行動過）：只能 call/fold，不能 raise
    expect(s.toAct).toBe(3);
    const la = legalActions(s);
    expect(la.call).toEqual({ amount: 2 });
    expect(la.raise).toBeNull();
  });

  it('不足額 all-in 之後、尚未行動的玩家仍可完整加注', () => {
    let s = newHand(config6({
      players: [
        { seat: 0, stack: 200, isCpu: false },
        { seat: 1, stack: 200, isCpu: true },
        { seat: 2, stack: 200, isCpu: true },
        { seat: 3, stack: 200, isCpu: true },
        { seat: 4, stack: 8, isCpu: true },
        { seat: 5, stack: 200, isCpu: true },
      ],
    }));
    s = applyAction(s, { type: 'raise', to: 6 });  // seat3
    s = applyAction(s, { type: 'raise', to: 8 });  // seat4 短 all-in
    // seat5 尚未行動 → 可加注，min = 8 + 4 = 12
    const la = legalActions(s);
    expect(la.raise).toEqual({ min: 12, max: 200 });
  });
});

describe('動作合法性', () => {
  it('面對注時 check 丟 ILLEGAL_ACTION', () => {
    const s = newHand(config6());
    expect(() => applyAction(s, { type: 'check' })).toThrowError(/ILLEGAL_ACTION/);
  });

  it('handOver 後任何下注動作丟 BAD_TIMING', () => {
    let s = newHand(config6());
    // 全部棄牌只剩 BB
    s = play(s, { type: 'fold' }, { type: 'fold' }, { type: 'fold' }, { type: 'fold' }, { type: 'fold' });
    expect(s.street).toBe('handOver');
    expect(() => applyAction(s, { type: 'check' })).toThrowError(/BAD_TIMING/);
  });
});

describe('換街', () => {
  it('flop 發 3 張、turn/river 各 1 張、行動從 button 後第一個 active 開始', () => {
    let s = newHand(config6());
    s = play(s,
      { type: 'call' }, { type: 'call' }, { type: 'call' },
      { type: 'call' }, { type: 'call' }, { type: 'check' },
    );
    expect(s.street).toBe('flop');
    expect(s.board).toHaveLength(3);
    expect(s.toAct).toBe(1); // SB
    expect(s.currentBet).toBe(0);
    expect(s.minRaise).toBe(2);
    // 全 check 進 turn
    s = play(s, { type: 'check' }, { type: 'check' }, { type: 'check' },
      { type: 'check' }, { type: 'check' }, { type: 'check' });
    expect(s.street).toBe('turn');
    expect(s.board).toHaveLength(4);
  });

  it('棄牌只剩一人直接進 handOver', () => {
    let s = newHand(config6());
    s = play(s, { type: 'fold' }, { type: 'fold' }, { type: 'fold' }, { type: 'fold' }, { type: 'fold' });
    expect(s.street).toBe('handOver');
  });

  it('heads-up：postflop 由 BB 先行動（spec §5/§11）', () => {
    let s = newHand(config6({
      players: [0, 1].map((seat) => ({ seat, stack: 200, isCpu: seat !== 0 })),
      button: 0,
    }));
    s = play(s, { type: 'call' }, { type: 'check' }); // button/SB 補齊、BB check
    expect(s.street).toBe('flop');
    expect(s.toAct).toBe(1); // BB 先行動，而非 button
  });
});

describe('純函式', () => {
  it('applyAction 不改動輸入 state', () => {
    const s = newHand(config6());
    const before = JSON.stringify(s);
    applyAction(s, { type: 'call' });
    expect(JSON.stringify(s)).toBe(before);
  });
});
