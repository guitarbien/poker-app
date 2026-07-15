import { describe, it, expect } from 'vitest';
import { createDeck, shuffle, cards } from '../engine/deck';
import { mulberry32 } from '../engine/rng';
import { newHand, applyAction, legalActions, nextButton, rebuy } from '../engine/game';
import { decideAction } from './strategy';

function fullTable(deck: number[]) {
  return newHand({
    players: [0, 1, 2, 3, 4, 5].map((seat) => ({ seat, stack: 200, isCpu: seat !== 0 })),
    button: 0,
    blinds: { sb: 1, bb: 2 },
    handNumber: 1,
    deck,
  });
}

describe('decideAction 合法性 soak', () => {
  it('100 手全 CPU 對局：所有決策皆合法、牌局必然終止', () => {
    const rng = mulberry32(715);
    let stacks = [200, 200, 200, 200, 200, 200];
    let button = 0;
    for (let hand = 1; hand <= 100; hand++) {
      let s = newHand({
        players: [0, 1, 2, 3, 4, 5].map((seat) => ({ seat, stack: stacks[seat], isCpu: true })),
        button,
        blinds: { sb: 1, bb: 2 },
        handNumber: hand,
        deck: shuffle(createDeck(), rng),
      });
      let steps = 0;
      while (s.street !== 'handOver') {
        // applyAction 對非法動作會 throw —— 不 throw 即證明合法
        s = applyAction(s, decideAction(s, s.toAct!, 'easy', rng));
        expect(++steps).toBeLessThan(2000);
      }
      for (const p of s.players) {
        if (p.stack === 0) s = rebuy(s, p.seat, 200);
      }
      stacks = [0, 1, 2, 3, 4, 5].map((seat) => s.players.find((p) => p.seat === seat)!.stack);
      button = nextButton(s);
    }
  }, 30_000);
});

describe('decideAction 行為特徵（easy）', () => {
  // 造一個 seat3（UTG）面對 BB 的 preflop 局面；rig 手牌
  function utgWith(hole: [string, string]) {
    const holeCards = cards(...hole);
    const rest = createDeck().filter((c) => !holeCards.includes(c));
    // 發牌順序 seat1..seat5, seat0；seat3 是第 3 個發牌 → deck 索引 4,5
    const deck = [rest[0], rest[1], rest[2], rest[3], holeCards[0], holeCards[1], ...rest.slice(4)];
    return fullTable(deck);
  }

  it('強牌（AA）面對注絕不棄牌', () => {
    const s = utgWith(['As', 'Ah']);
    for (let i = 0; i < 200; i++) {
      const a = decideAction(s, 3, 'easy', mulberry32(i));
      expect(a.type).not.toBe('fold');
    }
  });

  it('弱牌（72o）面對注以棄牌為主（60%–95%）', () => {
    const s = utgWith(['7s', '2d']);
    let folds = 0;
    for (let i = 0; i < 200; i++) {
      if (decideAction(s, 3, 'easy', mulberry32(i)).type === 'fold') folds++;
    }
    expect(folds).toBeGreaterThan(120);
    expect(folds).toBeLessThan(190);
  });

  it('postflop 成兩對面對注絕不棄牌', () => {
    // HU、button=1：發牌順序 seat0 先（button 下一位）；CPU seat1 拿 AK、翻牌 A K 7 成兩對
    const hole0 = cards('2c', '3d');
    const hole1 = cards('Ah', 'Kh');
    const board = cards('As', 'Kd', '7c', '9s', '4h');
    const used = [...hole0, ...hole1, ...board];
    const rest = createDeck().filter((c) => !used.includes(c));
    const deck = [...hole0, ...hole1, ...board, ...rest];
    let s = newHand({
      players: [
        { seat: 0, stack: 200, isCpu: false },
        { seat: 1, stack: 200, isCpu: true },
      ],
      button: 1,
      blinds: { sb: 1, bb: 2 },
      handNumber: 1,
      deck,
    });
    s = applyAction(s, { type: 'call' });         // seat1（button/SB）補齊
    s = applyAction(s, { type: 'check' });        // seat0（BB）→ flop
    s = applyAction(s, { type: 'raise', to: 4 }); // seat0（HU postflop BB 先行動）下注
    for (let i = 0; i < 200; i++) {
      expect(decideAction(s, 1, 'easy', mulberry32(i)).type).not.toBe('fold');
    }
  });

  it('回傳的加注金額一定落在合法區間', () => {
    const s = utgWith(['Ks', 'Kh']);
    for (let i = 0; i < 200; i++) {
      const a = decideAction(s, 3, 'easy', mulberry32(i));
      if (a.type === 'raise') {
        const la = legalActions(s);
        expect(a.to).toBeGreaterThanOrEqual(la.raise!.min);
        expect(a.to).toBeLessThanOrEqual(la.raise!.max);
      }
    }
  });
});
