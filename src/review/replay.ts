import type { Card } from '../engine/deck';
import type { GameState } from '../engine/game';
import { newHand, applyAction } from '../engine/game';
import type { HandRecord } from './recorder';

// 由 HandRecord 重建可重放的 riggedDeck：
// 發牌順序固定（button 下一位起每人 2 張），board 接續其後，其餘牌任意序補滿 52 張
export function replayDeck(record: HandRecord): Card[] {
  const players = [...record.players].sort((a, b) => a.seat - b.seat);
  const buttonIdx = players.findIndex((p) => p.seat === record.button);
  const holes: Card[] = [];
  for (let n = 0; n < players.length; n++) {
    const p = players[(buttonIdx + n + 1) % players.length];
    holes.push(p.hole[0], p.hole[1]);
  }
  const used = new Set<Card>([...holes, ...record.board]);
  const rest: Card[] = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
  return [...holes, ...record.board, ...rest];
}

// states[i] = 第 i 個動作「執行前」的 GameState；states[actions.length] = 終局
export function replayStates(record: HandRecord): GameState[] {
  const sortedPlayers = [...record.players].sort((a, b) => a.seat - b.seat);
  const states: GameState[] = [
    newHand({
      players: sortedPlayers.map((p) => ({ seat: p.seat, stack: p.stack, isCpu: p.isCpu })),
      button: record.button,
      blinds: record.blinds,
      handNumber: record.handNumber,
      deck: replayDeck(record),
    }),
  ];
  for (const entry of record.actions) {
    states.push(applyAction(states[states.length - 1], entry.action));
  }
  return states;
}
