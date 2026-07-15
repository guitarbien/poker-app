export interface KVStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStore(): KVStore {
  return window.localStorage;
}

export function load<T>(key: string, version: number, fallback: T, store: KVStore = defaultStore()): T {
  try {
    const raw = store.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw) as { version: number; data: T };
    if (parsed.version !== version) {
      console.warn(`[storage] ${key} 版本不符（${parsed.version} ≠ ${version}），以預設值重建`);
      return fallback;
    }
    return parsed.data;
  } catch (err) {
    console.warn(`[storage] 讀取 ${key} 失敗，以預設值重建`, err);
    return fallback;
  }
}

export function save<T>(key: string, version: number, data: T, store: KVStore = defaultStore()): boolean {
  try {
    store.setItem(key, JSON.stringify({ version, data }));
    return true;
  } catch (err) {
    console.warn(`[storage] 寫入 ${key} 失敗`, err);
    return false;
  }
}
