import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';
import type { KVStore } from '../../storage/storage';

function makeStore(init: Record<string, string> = {}): KVStore {
  const map = new Map<string, string>(Object.entries(init));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

const KEY = 'holdem.settings';

describe('loadSettings', () => {
  it('空 store 回傳 DEFAULT_SETTINGS', () => {
    expect(loadSettings(makeStore())).toEqual(DEFAULT_SETTINGS);
  });

  it('缺欄位以預設值補齊', () => {
    const store = makeStore({ [KEY]: JSON.stringify({ version: 1, data: { assistEnabled: false } }) });
    const s = loadSettings(store);
    expect(s.assistEnabled).toBe(false);
    expect(s.cpuCount).toBe(DEFAULT_SETTINGS.cpuCount);
    expect(s.blinds).toEqual(DEFAULT_SETTINGS.blinds);
    expect(s.difficulties).toEqual(DEFAULT_SETTINGS.difficulties);
  });

  it('difficulties 太短時補 easy', () => {
    const store = makeStore({
      [KEY]: JSON.stringify({ version: 1, data: { cpuCount: 3, difficulties: ['hard'] } }),
    });
    expect(loadSettings(store).difficulties).toEqual(['hard', 'easy', 'easy']);
  });

  it('difficulties 太長時裁切', () => {
    const store = makeStore({
      [KEY]: JSON.stringify({ version: 1, data: { cpuCount: 2, difficulties: ['hard', 'normal', 'easy'] } }),
    });
    expect(loadSettings(store).difficulties).toEqual(['hard', 'normal']);
  });

  it('JSON 格式錯誤回傳預設值', () => {
    const store = makeStore({ [KEY]: 'not-json' });
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });

  it('版本不符回傳預設值', () => {
    const store = makeStore({ [KEY]: JSON.stringify({ version: 99, data: { cpuCount: 2 } }) });
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });

  it('cpuCount 超界（0/99/NaN）被 clamp 到 1–5', () => {
    for (const [input, expected] of [[0, 1], [99, 5], [NaN, 1]] as const) {
      const store = makeStore({
        [KEY]: JSON.stringify({ version: 1, data: { cpuCount: input, difficulties: [] } }),
      });
      const s = loadSettings(store);
      expect(s.cpuCount).toBe(expected);
      expect(s.difficulties).toHaveLength(expected);
    }
  });
});

describe('saveSettings + loadSettings roundtrip', () => {
  it('存取後可完整還原', () => {
    const store = makeStore();
    const custom = {
      ...DEFAULT_SETTINGS,
      assistEnabled: false,
      cpuCount: 3,
      difficulties: ['easy', 'hard', 'normal'] as ['easy', 'hard', 'normal'],
    };
    saveSettings(custom, store);
    expect(loadSettings(store)).toEqual(custom);
  });
});
