import { describe, it, expect } from 'vitest';
import { recordHand, EMPTY_STATS } from './stats';
import type { HandRecord } from '../review/recorder';
import { cards } from '../engine/deck';

describe('stats', () => {
  describe('recordHand', () => {
    // 測試錨點1：seat 0 preflop fold（vpip 不變、winnings 負盲注）
    it('scenario 1: seat 0 folds preflop', () => {
      const record: HandRecord = {
        version: 1,
        handNumber: 1,
        timestamp: Date.now(),
        blinds: { sb: 1, bb: 2 },
        button: 2,
        players: [
          { seat: 0, stack: 100, hole: cards('2h', '3d') as any, isCpu: false },
          { seat: 1, stack: 100, hole: cards('Ah', 'Kh') as any, isCpu: true },
        ],
        actions: [
          // seat 0 posts BB 2, posts action count -2
          // seat 1 opens to 4
          // seat 0 folds
          { seat: 1, street: 'preflop', action: { type: 'raise', to: 4 }, potAfter: 6 },
          { seat: 0, street: 'preflop', action: { type: 'fold' }, potAfter: 6 },
        ],
        board: cards(),
        potResults: [
          {
            potIndex: 0,
            winners: [{ seat: 1, amount: 3, handRank: null }],
          },
        ],
        humanNet: -2,
        flags: [],
      };

      const stats = recordHand(EMPTY_STATS, record);
      expect(stats.handsPlayed).toBe(1);
      expect(stats.totalWinnings).toBe(-2); // 負盲注
      expect(stats.vpipHands).toBe(0);
      expect(stats.pfrHands).toBe(0);
      expect(stats.showdownsSeen).toBe(0);
      expect(stats.showdownsWon).toBe(0);
    });

    // 測試錨點2：seat 0 raise 進攤牌獲勝
    it('scenario 2: seat 0 raises, goes to showdown and wins', () => {
      const record: HandRecord = {
        version: 1,
        handNumber: 2,
        timestamp: Date.now(),
        blinds: { sb: 1, bb: 2 },
        button: 2,
        players: [
          { seat: 0, stack: 100, hole: ['Ah', 'Kh'] as any, isCpu: false },
          { seat: 1, stack: 100, hole: ['Qc', 'Qs'] as any, isCpu: true },
        ],
        actions: [
          // seat 0 raises to 6
          { seat: 0, street: 'preflop', action: { type: 'raise', to: 6 }, potAfter: 8 },
          // seat 1 calls
          { seat: 1, street: 'preflop', action: { type: 'call' }, potAfter: 12 },
          // flop: seat 1 checks
          { seat: 1, street: 'flop', action: { type: 'check' }, potAfter: 12 },
          // seat 0 bets
          { seat: 0, street: 'flop', action: { type: 'raise', to: 10 }, potAfter: 22 },
          // seat 1 calls
          { seat: 1, street: 'flop', action: { type: 'call' }, potAfter: 32 },
          // turn: both check
          { seat: 1, street: 'turn', action: { type: 'check' }, potAfter: 32 },
          { seat: 0, street: 'turn', action: { type: 'check' }, potAfter: 32 },
          // river: both check
          { seat: 1, street: 'river', action: { type: 'check' }, potAfter: 32 },
          { seat: 0, street: 'river', action: { type: 'check' }, potAfter: 32 },
        ],
        board: cards('Ah', 'Kc', '2d', '3h', '5s'),
        potResults: [
          {
            potIndex: 0,
            // seat 0 手牌 AK high，seat 1 手牌 QQ，seat 0 勝利
            winners: [{ seat: 0, amount: 32, handRank: 1 }],
          },
        ],
        humanNet: 16, // +16 淨贏
        flags: [],
      };

      const stats = recordHand(EMPTY_STATS, record);
      expect(stats.handsPlayed).toBe(1);
      expect(stats.totalWinnings).toBe(16);
      expect(stats.vpipHands).toBe(1); // preflop raise
      expect(stats.pfrHands).toBe(1);
      expect(stats.showdownsSeen).toBe(1);
      expect(stats.showdownsWon).toBe(1);
    });

    // 測試錨點3：seat 0 limp 後 flop fold
    it('scenario 3: seat 0 limps, folds on flop', () => {
      const record: HandRecord = {
        version: 1,
        handNumber: 3,
        timestamp: Date.now(),
        blinds: { sb: 1, bb: 2 },
        button: 2,
        players: [
          { seat: 0, stack: 100, hole: ['Js', '9s'] as any, isCpu: false },
          { seat: 1, stack: 100, hole: ['Ah', 'Kh'] as any, isCpu: true },
        ],
        actions: [
          // seat 0 calls (limp)
          { seat: 0, street: 'preflop', action: { type: 'call' }, potAfter: 4 },
          // seat 1 checks
          { seat: 1, street: 'preflop', action: { type: 'check' }, potAfter: 4 },
          // flop: seat 1 bets
          { seat: 1, street: 'flop', action: { type: 'raise', to: 3 }, potAfter: 7 },
          // seat 0 folds
          { seat: 0, street: 'flop', action: { type: 'fold' }, potAfter: 7 },
        ],
        board: cards('2c', '5h', '7d'),
        potResults: [
          {
            potIndex: 0,
            winners: [{ seat: 1, amount: 7, handRank: null }],
          },
        ],
        humanNet: -2, // 虧 SB 沒有額外虧損
        flags: [],
      };

      const stats = recordHand(EMPTY_STATS, record);
      expect(stats.handsPlayed).toBe(1);
      expect(stats.totalWinnings).toBe(-2);
      expect(stats.vpipHands).toBe(1); // preflop call
      expect(stats.pfrHands).toBe(0); // 沒有 raise
      expect(stats.showdownsSeen).toBe(0); // fold 了沒進攤牌
      expect(stats.showdownsWon).toBe(0);
    });

    // 累計多筆紀錄
    it('accumulates stats from multiple hands', () => {
      const hand1: HandRecord = {
        version: 1,
        handNumber: 1,
        timestamp: Date.now(),
        blinds: { sb: 1, bb: 2 },
        button: 2,
        players: [
          { seat: 0, stack: 100, hole: ['Ah', 'Kh'] as any, isCpu: false },
          { seat: 1, stack: 100, hole: ['2c', '3c'] as any, isCpu: true },
        ],
        actions: [
          { seat: 0, street: 'preflop', action: { type: 'raise', to: 6 }, potAfter: 8 },
          { seat: 1, street: 'preflop', action: { type: 'fold' }, potAfter: 8 },
        ],
        board: cards(),
        potResults: [
          { potIndex: 0, winners: [{ seat: 0, amount: 3, handRank: null }] },
        ],
        humanNet: 1,
        flags: [],
      };

      const hand2: HandRecord = {
        version: 1,
        handNumber: 2,
        timestamp: Date.now(),
        blinds: { sb: 1, bb: 2 },
        button: 2,
        players: [
          { seat: 0, stack: 101, hole: ['Js', '9s'] as any, isCpu: false },
          { seat: 1, stack: 99, hole: ['Ah', 'Kh'] as any, isCpu: true },
        ],
        actions: [
          { seat: 0, street: 'preflop', action: { type: 'call' }, potAfter: 4 },
          { seat: 1, street: 'preflop', action: { type: 'check' }, potAfter: 4 },
          { seat: 1, street: 'flop', action: { type: 'raise', to: 3 }, potAfter: 7 },
          { seat: 0, street: 'flop', action: { type: 'fold' }, potAfter: 7 },
        ],
        board: cards('2c', '5h', '7d'),
        potResults: [
          { potIndex: 0, winners: [{ seat: 1, amount: 7, handRank: null }] },
        ],
        humanNet: -2,
        flags: [],
      };

      let stats = recordHand(EMPTY_STATS, hand1);
      stats = recordHand(stats, hand2);

      expect(stats.handsPlayed).toBe(2);
      expect(stats.totalWinnings).toBe(-1); // 1 + (-2)
      expect(stats.vpipHands).toBe(2); // raise + call
      expect(stats.pfrHands).toBe(1); // 一次 raise
      expect(stats.showdownsSeen).toBe(0);
      expect(stats.showdownsWon).toBe(0);
    });

    // showdown 情境：未 fold，發生攤牌但沒贏
    it('showdown seen but not won', () => {
      const record: HandRecord = {
        version: 1,
        handNumber: 1,
        timestamp: Date.now(),
        blinds: { sb: 1, bb: 2 },
        button: 2,
        players: [
          { seat: 0, stack: 100, hole: ['Js', '9s'] as any, isCpu: false },
          { seat: 1, stack: 100, hole: ['Ah', 'Kh'] as any, isCpu: true },
        ],
        actions: [
          { seat: 0, street: 'preflop', action: { type: 'call' }, potAfter: 4 },
          { seat: 1, street: 'preflop', action: { type: 'check' }, potAfter: 4 },
          { seat: 1, street: 'flop', action: { type: 'check' }, potAfter: 4 },
          { seat: 0, street: 'flop', action: { type: 'check' }, potAfter: 4 },
          { seat: 1, street: 'turn', action: { type: 'check' }, potAfter: 4 },
          { seat: 0, street: 'turn', action: { type: 'check' }, potAfter: 4 },
          { seat: 1, street: 'river', action: { type: 'check' }, potAfter: 4 },
          { seat: 0, street: 'river', action: { type: 'check' }, potAfter: 4 },
        ],
        board: cards('2c', '5h', '7d', '8c', 'Tc'),
        potResults: [
          {
            potIndex: 0,
            // seat 1 贏（AK high vs J9 high）
            winners: [{ seat: 1, amount: 4, handRank: 2 }],
          },
        ],
        humanNet: -2,
        flags: [],
      };

      const stats = recordHand(EMPTY_STATS, record);
      expect(stats.handsPlayed).toBe(1);
      expect(stats.totalWinnings).toBe(-2);
      expect(stats.vpipHands).toBe(1);
      expect(stats.pfrHands).toBe(0);
      expect(stats.showdownsSeen).toBe(1); // 進了攤牌
      expect(stats.showdownsWon).toBe(0); // 但沒贏
    });
  });
});
