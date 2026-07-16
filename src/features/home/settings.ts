import type { Difficulty } from '../../engine/game';
import { load, save, type KVStore } from '../../storage/storage';

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

const SETTINGS_KEY = 'holdem.settings';
const SETTINGS_VERSION = 1;

function normalize(s: Settings): Settings {
  const cpuCount = Math.min(5, Math.max(1, Math.round(s.cpuCount)));
  const diffs = Array.isArray(s.difficulties) ? [...s.difficulties] : [];
  while (diffs.length < cpuCount) diffs.push('easy');
  return { ...s, cpuCount, difficulties: diffs.slice(0, cpuCount) };
}

export function loadSettings(store?: KVStore): Settings {
  const raw = load(SETTINGS_KEY, SETTINGS_VERSION, DEFAULT_SETTINGS, store);
  const merged: Settings = { ...DEFAULT_SETTINGS, ...raw };
  return normalize(merged);
}

export function saveSettings(s: Settings, store?: KVStore): void {
  save(SETTINGS_KEY, SETTINGS_VERSION, s, store);
}
