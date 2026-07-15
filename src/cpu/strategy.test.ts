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

function utgWith(hole: [string, string]) {
  const holeCards = cards(...hole);
  const rest = createDeck().filter((c) => !holeCards.includes(c));
  // 發牌順序 seat1..seat5, seat0；seat3 是第 3 個發牌 → deck 索引 4,5
  const deck = [rest[0], rest[1], rest[2], rest[3], holeCards[0], holeCards[1], ...rest.slice(4)];
  return fullTable(deck);
}

function utgWith2(holeSeat3: [string, string], holeSeat4: [string, string]) {
  const hole3 = cards(...holeSeat3);
  const hole4 = cards(...holeSeat4);
  const used = [...hole3, ...hole4];
  const rest = createDeck().filter((c) => !used.includes(c));
  // 6 人桌 button 0：發牌順序 seat1(0,1), seat2(2,3), seat3(4,5), seat4(6,7), seat5(8,9), seat0(10,11)
  const deck = [rest[0], rest[1], rest[2], rest[3], hole3[0], hole3[1], hole4[0], hole4[1], rest[4], rest[5], rest[6], rest[7], ...rest.slice(8)];
  return fullTable(deck);
}

function huRigged(holeSeat0: [string, string], holeSeat1: [string, string], board: [string, string, string, string, string]) {
  const hole0 = cards(...holeSeat0);
  const hole1 = cards(...holeSeat1);
  const boardCards = cards(...board);
  const used = [...hole0, ...hole1, ...boardCards];
  const rest = createDeck().filter((c) => !used.includes(c));
  // HU button 1：發牌順序 seat0(0,1), seat1(2,3)
  const deck = [hole0[0], hole0[1], hole1[0], hole1[1], ...boardCards, ...rest];
  return newHand({
    players: [
      { seat: 0, stack: 200, isCpu: false },
      { seat: 1, stack: 200, isCpu: true },
    ],
    button: 1,
    blinds: { sb: 1, bb: 2 },
    handNumber: 1,
    deck,
  });
}

describe('decideAction 難度分派與合法性', () => {
  it('normal 與 hard 各 60 手全 CPU 對局：決策皆合法且終止', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      const rng = mulberry32(difficulty === 'normal' ? 33 : 44);
      let stacks = [200, 200, 200, 200, 200, 200];
      let button = 0;
      for (let hand = 1; hand <= 60; hand++) {
        let s = newHand({
          players: [0, 1, 2, 3, 4, 5].map((seat) => ({ seat, stack: stacks[seat], isCpu: true })),
          button, blinds: { sb: 1, bb: 2 }, handNumber: hand,
          deck: shuffle(createDeck(), rng),
        });
        let steps = 0;
        while (s.street !== 'handOver') {
          s = applyAction(s, decideAction(s, s.toAct!, difficulty, rng));
          expect(++steps).toBeLessThan(2000);
        }
        for (const p of s.players) if (p.stack === 0) s = rebuy(s, p.seat, 200);
        stacks = [0, 1, 2, 3, 4, 5].map((seat) => s.players.find((p) => p.seat === seat)!.stack);
        button = nextButton(s);
      }
    }
  }, 60_000);
});

describe('normal 行為錨點', () => {
  it('UTG 照表開牌：AJo 加注 2.5BB、ATo 棄牌、72o 棄牌', () => {
    // 無 rng 分支：open/fold 是決定性的
    expect(decideAction(utgWith(['As', 'Jd']), 3, 'normal', mulberry32(1)))
      .toEqual({ type: 'raise', to: 5 });
    expect(decideAction(utgWith(['As', 'Td']), 3, 'normal', mulberry32(1)).type).toBe('fold');
    expect(decideAction(utgWith(['7s', '2d']), 3, 'normal', mulberry32(1)).type).toBe('fold');
  });

  it('面對加注拿 AA 絕不棄牌', () => {
    // seat3 open 後輪 seat4；rig seat3=KQo、seat4=AA
    let s = utgWith2(['Ks', 'Qd'], ['Ah', 'Ad']);
    s = applyAction(s, { type: 'raise', to: 6 }); // seat3 open（測試手動代打）
    for (let i = 0; i < 100; i++) {
      expect(decideAction(s, 4, 'normal', mulberry32(i)).type).not.toBe('fold');
    }
  });
});

describe('hard 行為錨點', () => {
  it('河牌坐擁堅果面對注絕不棄牌', () => {
    // HU rig：CPU seat1 拿 9c9s、board 9h 9d 5c 2s 7h（四條九，不可能被反超）
    let s = huRigged(['2c', '3d'], ['9c', '9s'], ['9h', '9d', '5c', '2s', '7h']);
    // 打到河牌：preflop call/check、flop check/check、turn check/check、river 人類下注
    s = applyAction(s, { type: 'call' });   // preflop：seat1（button/SB）補齊
    s = applyAction(s, { type: 'check' });  // seat0（BB）→ flop
    for (let i = 0; i < 2; i++) { s = applyAction(s, { type: 'check' }); s = applyAction(s, { type: 'check' }); } // flop、turn 全過牌
    s = applyAction(s, { type: 'raise', to: 10 }); // river：seat0（BB 先行動）下注
    for (let i = 0; i < 60; i++) {
      expect(decideAction(s, 1, 'hard', mulberry32(i)).type).not.toBe('fold');
    }
  });

  it('河牌垃圾牌面對大注以棄牌為主', () => {
    // CPU 拿 2c3d 高牌、board 無連結，面對滿池注
    let s = huRigged(['Ah', 'Kh'], ['2c', '3d'], ['Ts', 'Jd', '6h', 'Qc', '8s']);
    s = applyAction(s, { type: 'call' });
    s = applyAction(s, { type: 'check' });
    for (let i = 0; i < 2; i++) { s = applyAction(s, { type: 'check' }); s = applyAction(s, { type: 'check' }); }
    s = applyAction(s, { type: 'raise', to: 8 }); // river：seat0 下滿池注
    let folds = 0;
    for (let i = 0; i < 100; i++) {
      if (decideAction(s, 1, 'hard', mulberry32(i)).type === 'fold') folds++;
    }
    expect(folds).toBeGreaterThan(70);
  });
});

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
