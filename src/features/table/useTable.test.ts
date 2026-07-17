import { describe, it, expect } from 'vitest';
import { createDeck } from '../../engine/deck';
import { reducer } from './useTable';

const CONFIG = { cpuCount: 1, difficulties: ['easy'] as import('../../engine/game').Difficulty[], blinds: { sb: 1, bb: 2 } };

describe('reducer 純函式 / StrictMode 防重複記錄', () => {
  it('同一 start event 呼叫 reducer 兩次，結果相等且 entries 無重複', () => {
    const deck = createDeck();
    const init = { game: null, humanBusted: false, handLog: null };

    // StrictMode 會以同一 (state, event) 重複呼叫
    const s1 = reducer(init, { type: 'start', config: CONFIG, deck: [...deck] });
    const s2 = reducer(init, { type: 'start', config: CONFIG, deck: [...deck] });

    expect(s1.game?.handNumber).toBe(s2.game?.handNumber);
    expect(s1.handLog?.handNumber).toBe(s2.handLog?.handNumber);
    // entries 初始皆為空（沒有動作被記兩次）
    expect(s1.handLog?.entries).toHaveLength(0);
    expect(s2.handLog?.entries).toHaveLength(0);
  });

  it('同一 action event 呼叫 reducer 兩次，entries 長度相同（純函式不累積）', () => {
    const deck = createDeck();
    const init = { game: null, humanBusted: false, handLog: null };
    const started = reducer(init, { type: 'start', config: CONFIG, deck: [...deck] });

    expect(started.game).not.toBeNull();
    expect(started.game?.street).not.toBe('handOver');

    const actionEv = { type: 'cpuAction' as const, action: { type: 'fold' as const } };

    // 同一 state 呼叫兩次（StrictMode 模擬）
    const r1 = reducer(started, actionEv);
    const r2 = reducer(started, actionEv);

    // 兩次結果的 entries 長度相同（都只加 1 筆）
    expect(r1.handLog?.entries.length).toBe(r2.handLog?.entries.length);
    // 街道相同（pure output）
    expect(r1.game?.street).toBe(r2.game?.street);
  });

  it('immutable append：原 entries 陣列不被修改', () => {
    const deck = createDeck();
    const init = { game: null, humanBusted: false, handLog: null };
    const started = reducer(init, { type: 'start', config: CONFIG, deck: [...deck] });

    expect(started.game).not.toBeNull();
    expect(started.game?.street).not.toBe('handOver');
    const originalEntries = started.handLog?.entries;

    // 呼叫 reducer 後原陣列不應被 push 修改
    reducer(started, { type: 'cpuAction', action: { type: 'fold' } });
    expect(originalEntries).toHaveLength(0);
  });
});
