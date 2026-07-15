import { describe, it, expect } from 'vitest';
import { createDeck } from '../../engine/deck';
import { newHand, applyAction } from '../../engine/game';
import {
  BUY_IN_BB, initialHandConfig, settleBetweenHands, nextHandConfig, humanRebuy,
} from './session';

const CONFIG = { cpuCount: 5, cpuDifficulty: 'easy' as const, blinds: { sb: 1, bb: 2 } };

function playToHandOver() {
  let s = newHand(initialHandConfig(CONFIG, createDeck()));
  while (s.street !== 'handOver') s = applyAction(s, { type: 'fold' });
  return s;
}

describe('initialHandConfig', () => {
  it('human seat 0 + 5 CPU、全員 200、button 0、handNumber 1', () => {
    const c = initialHandConfig(CONFIG, createDeck());
    expect(c.players).toHaveLength(6);
    expect(c.players[0]).toMatchObject({ seat: 0, stack: 200, isCpu: false });
    expect(c.players[1]).toMatchObject({ seat: 1, stack: 200, isCpu: true, difficulty: 'easy' });
    expect(c.handNumber).toBe(1);
  });
});

describe('settleBetweenHands', () => {
  it('CPU 破產自動補滿、人類破產只回報不補', () => {
    let s = playToHandOver();
    // 手動製造破產狀態來測 settle 邏輯
    s = structuredClone(s);
    s.players[2].stack = 0; // CPU
    s.players[0].stack = 0; // human
    const r = settleBetweenHands(s);
    expect(r.state.players[2].stack).toBe(BUY_IN_BB * 2);
    expect(r.state.players[0].stack).toBe(0);
    expect(r.humanBusted).toBe(true);
  });

  it('無人破產：state 不變、humanBusted false', () => {
    const s = playToHandOver();
    const r = settleBetweenHands(s);
    expect(r.humanBusted).toBe(false);
    expect(r.state.players.map((p) => p.stack)).toEqual(s.players.map((p) => p.stack));
  });
});

describe('nextHandConfig', () => {
  it('button 輪轉、stacks 帶入、handNumber 遞增', () => {
    const s = playToHandOver();
    const c = nextHandConfig(s, createDeck());
    expect(c.button).toBe(1);
    expect(c.handNumber).toBe(2);
    expect(c.players.map((p) => p.stack)).toEqual(s.players.map((p) => p.stack));
  });
});

describe('humanRebuy', () => {
  it('人類補滿至買入上限', () => {
    let s = playToHandOver();
    s = structuredClone(s);
    s.players[0].stack = 0;
    const after = humanRebuy(s);
    expect(after.players[0].stack).toBe(BUY_IN_BB * 2);
  });
});
