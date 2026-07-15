import { describe, it, expect } from 'vitest';
import { createDeck, shuffle } from './deck';
import { mulberry32 } from './rng';
import {
  newHand, applyAction, legalActions, nextButton, rebuy,
  type GameState, type Action,
} from './game';

// 隨機挑一個合法動作
function randomAction(state: GameState, rng: () => number): Action {
  const la = legalActions(state);
  const options: Action[] = [];
  if (la.check) options.push({ type: 'check' });
  if (la.call) options.push({ type: 'call' });
  if (la.fold) options.push({ type: 'fold' });
  if (la.raise) {
    const to = la.raise.min + Math.floor(rng() * (la.raise.max - la.raise.min + 1));
    options.push({ type: 'raise', to });
  }
  return options[Math.floor(rng() * options.length)];
}

describe('隨機牌局 soak：不變量', () => {
  it('200 手隨機牌局：籌碼守恆、狀態機必然終止、無非法狀態', () => {
    const rng = mulberry32(20260714);
    const seats = [0, 1, 2, 3, 4, 5];
    let stacks = seats.map(() => 200);
    let button = 0;
    let total = 200 * 6; // 守恆基準：隨補碼同步增加

    for (let hand = 1; hand <= 200; hand++) {
      let s = newHand({
        players: seats.map((seat) => ({ seat, stack: stacks[seat], isCpu: seat !== 0 })),
        button,
        blinds: { sb: 1, bb: 2 },
        handNumber: hand,
        deck: shuffle(createDeck(), rng),
      });

      let steps = 0;
      while (s.street !== 'handOver') {
        s = applyAction(s, randomAction(s, rng));
        steps++;
        expect(steps).toBeLessThan(2000); // 終止保證（理論上限遠低於此）
      }

      expect(s.result).not.toBeNull();
      const sum = s.players.reduce((acc, p) => acc + p.stack, 0);
      expect(sum).toBe(total); // 籌碼守恆（每手結束時全部回到 stack）

      // 破產者補碼（模擬 CPU 自動重買）
      for (const p of s.players) {
        if (p.stack === 0) {
          s = rebuy(s, p.seat, 200);
          total += 200;
        }
      }
      stacks = seats.map((seat) => s.players.find((p) => p.seat === seat)!.stack);
      button = nextButton(s);
    }
  }, 30_000);
});
