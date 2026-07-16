import type { Difficulty } from '../../engine/game';
import type { KVStore } from '../../storage/storage';

export interface Settings {
  blinds: { sb: number; bb: number };
  cpuCount: number;        // 1–5
  difficulties: Difficulty[]; // 長度 = cpuCount
  assistEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  blinds: { sb: 1, bb: 2 },
  cpuCount: 5,
  difficulties: ['easy', 'easy', 'easy', 'easy', 'easy'],
  assistEnabled: true,
};

const SETTINGS_KEY = 'holdem:settings';

function defaultStore(): KVStore {
  return window.localStorage;
}

export function loadSettings(store: KVStore = defaultStore()): Settings {
  try {
    const raw = store.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, difficulties: [...DEFAULT_SETTINGS.difficulties] };
    const data = JSON.parse(raw) as Partial<Settings>;
    const merged: Settings = { ...DEFAULT_SETTINGS, ...data };
    // normalize difficulties length to match cpuCount
    const count = merged.cpuCount;
    const diffs = Array.isArray(merged.difficulties) ? [...merged.difficulties] : [];
    while (diffs.length < count) diffs.push('easy');
    merged.difficulties = diffs.slice(0, count);
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS, difficulties: [...DEFAULT_SETTINGS.difficulties] };
  }
}

export function saveSettings(s: Settings, store: KVStore = defaultStore()): void {
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore write failures
  }
}
