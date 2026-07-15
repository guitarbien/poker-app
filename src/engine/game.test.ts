import { describe, it, expect } from 'vitest';
import { createDeck } from './deck';
import { newHand, positionOf, nextButton, type NewHandConfig } from './game';

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
