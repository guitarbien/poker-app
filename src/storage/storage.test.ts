import { describe, it, expect, vi } from 'vitest';
import { load, save, type KVStore } from './storage';

function memStore(init: Record<string, string> = {}): KVStore {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

describe('storage', () => {
  it('save 後 load 取回原資料', () => {
    const s = memStore();
    expect(save('k', 1, { a: 1 }, s)).toBe(true);
    expect(load('k', 1, { a: 0 }, s)).toEqual({ a: 1 });
  });

  it('不存在 / JSON 壞掉 / version 不符 → 回 fallback', () => {
    const s = memStore({ bad: '{oops', old: JSON.stringify({ version: 1, data: 5 }) });
    expect(load('none', 1, 'fb', s)).toBe('fb');
    expect(load('bad', 1, 'fb', s)).toBe('fb');
    expect(load('old', 2, 'fb', s)).toBe('fb'); // 版本不符
  });

  it('setItem 丟例外（quota）→ save 回傳 false', () => {
    const s = memStore();
    s.setItem = vi.fn(() => { throw new Error('QuotaExceededError'); });
    expect(save('k', 1, 'x', s)).toBe(false);
  });
});
