import type { Card } from '../engine/deck';
import type { Action, GameState, PotResult } from '../engine/game';
import { load, save, type KVStore } from '../storage/storage';

export interface ReviewFlag {
  actionIndex: number;
  kind: 'preflop-loose' | 'preflop-tight' | 'call-without-odds';
  detail?: { requiredEquity?: number; estimatedEquity?: number };
}

export interface HandRecord {
  version: number;         // 1
  handNumber: number;
  timestamp: number;
  blinds: { sb: number; bb: number };
  button: number;
  players: { seat: number; stack: number; hole: [Card, Card]; isCpu: boolean }[];
  actions: { seat: number; street: string; action: Action; potAfter: number }[];
  board: Card[];
  potResults: PotResult[];
  humanNet: number;        // 人類本手淨損益 = 結束 stack − 起始 stack
  flags: ReviewFlag[];     // M3 一律 []；M4 填入
}

export interface HandLog {
  startPlayers: HandRecord['players'];   // newHand 前的 config 快照（stack 含盲注前）
  blinds: { sb: number; bb: number };
  button: number;
  handNumber: number;
  entries: HandRecord['actions'];
}

export function buildHandRecord(log: HandLog, final: GameState, timestamp: number): HandRecord {
  const startHuman = log.startPlayers.find((p) => !p.isCpu)!;
  const finalHuman = final.players.find((p) => !p.isCpu)!;
  return {
    version: 1,
    handNumber: log.handNumber,
    timestamp,
    blinds: log.blinds,
    button: log.button,
    players: log.startPlayers,
    actions: log.entries,
    board: final.board,
    potResults: final.result ?? [],
    humanNet: finalHuman.stack - startHuman.stack,
    flags: [],
  };
}

export const HANDS_KEY = 'holdem.hands';
export const HANDS_VERSION = 1;
export const HANDS_LIMIT = 500;

// ponytail: store 參數傳遞 load/save 以重用既有 storage 邏輯

export function loadHands(store?: KVStore): HandRecord[] {
  const s = store ?? window.localStorage;
  return load<HandRecord[]>(HANDS_KEY, HANDS_VERSION, [], s);
}

export function appendHand(record: HandRecord, store?: KVStore): void {
  const s = store ?? window.localStorage;
  const hands = loadHands(s);
  hands.push(record);
  // 環形緩衝：超過上限淘汰最舊
  const trimmed = hands.length > HANDS_LIMIT ? hands.slice(hands.length - HANDS_LIMIT) : hands;

  if (!save(HANDS_KEY, HANDS_VERSION, trimmed, s)) {
    // quota exceeded → 砍半重試一次
    save(HANDS_KEY, HANDS_VERSION, trimmed.slice(Math.ceil(trimmed.length / 2)), s);
  }
}
