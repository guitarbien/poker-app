import type { HandRecord } from '../review/recorder';

export interface Stats {
  handsPlayed: number;
  totalWinnings: number;
  vpipHands: number;
  pfrHands: number;
  showdownsSeen: number;
  showdownsWon: number;
}

export const EMPTY_STATS: Stats = {
  handsPlayed: 0,
  totalWinnings: 0,
  vpipHands: 0,
  pfrHands: 0,
  showdownsSeen: 0,
  showdownsWon: 0,
};

export const STATS_KEY = 'holdem.stats';
export const STATS_VERSION = 1;

export function recordHand(prev: Stats, record: HandRecord): Stats {
  const humanSeat = 0; // seat 0 is always human
  let vpipHands = prev.vpipHands;
  let pfrHands = prev.pfrHands;
  let showdownsSeen = prev.showdownsSeen;
  let showdownsWon = prev.showdownsWon;

  // vpip & pfr：掃 preflop actions
  let humanActedPreflop = false;
  let humanRaisedPreflop = false;

  for (const action of record.actions) {
    if (action.seat === humanSeat && action.street === 'preflop') {
      if (action.action.type === 'call' || action.action.type === 'raise') {
        humanActedPreflop = true;
      }
      if (action.action.type === 'raise') {
        humanRaisedPreflop = true;
      }
    }
  }

  if (humanActedPreflop) {
    vpipHands += 1;
  }
  if (humanRaisedPreflop) {
    pfrHands += 1;
  }

  // showdown：檢查是否有 handRank !== null 的 winner，且 human 沒有 fold
  let humanFolded = false;
  for (const action of record.actions) {
    if (action.seat === humanSeat && action.action.type === 'fold') {
      humanFolded = true;
      break;
    }
  }

  const hadShowdown = record.potResults.some((result) => result.winners.some((w) => w.handRank !== null));

  if (hadShowdown && !humanFolded) {
    showdownsSeen += 1;
  }

  // showdownsWon：showdown 中 seat 0 出現在 winners 中
  if (hadShowdown) {
    const humanWon = record.potResults.some((result) => result.winners.some((w) => w.seat === humanSeat && w.handRank !== null));
    if (humanWon) {
      showdownsWon += 1;
    }
  }

  return {
    handsPlayed: prev.handsPlayed + 1,
    totalWinnings: prev.totalWinnings + record.humanNet,
    vpipHands,
    pfrHands,
    showdownsSeen,
    showdownsWon,
  };
}
