import type { Rng } from '../engine/rng';
import type { GameState } from '../engine/game';
import { positionOf } from '../engine/game';
import { RFI_RANGES, isInRange } from '../engine/ranges';
import { equity, DEFAULT_ITERATIONS } from '../engine/equity';
import type { HandRecord, ReviewFlag } from './recorder';
import { replayStates } from './replay';

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

// MC 噪音緩衝（spec §9b）
const ODDS_BUFFER = 0.02;

// 修訂版 RFI 判定：掃 record.actions 前面的動作
// 排除前有 limp（call）或加注（raise）的情境，讓分子分母同源
function isRfiSpot(
  record: HandRecord,
  actionIndex: number,
  state: GameState,
  humanSeat: number,
): boolean {
  if (positionOf(state, humanSeat) === 'BB') return false;
  for (let i = 0; i < actionIndex; i++) {
    const e = record.actions[i];
    if (e.street === 'preflop' && e.seat !== humanSeat) {
      if (e.action.type === 'call' || e.action.type === 'raise') return false;
    }
  }
  return true;
}

// 分子與分母同源，避免偵測邏輯寫兩份造成 drift
export interface GradeResult {
  flags: ReviewFlag[];
  opportunities: { rfi: number; postflopCall: number };
}

export function gradeHand(record: HandRecord, rng: Rng): GradeResult {
  const human = record.players.find((p) => !p.isCpu)!;
  const states = replayStates(record);
  const flags: ReviewFlag[] = [];
  let rfi = 0;
  let postflopCall = 0;

  record.actions.forEach((entry, actionIndex) => {
    if (entry.seat !== human.seat) return;
    const state = states[actionIndex];

    if (state.street === 'preflop') {
      if (!isRfiSpot(record, actionIndex, state, human.seat)) return;
      rfi++;
      const pos = positionOf(state, human.seat) as Exclude<ReturnType<typeof positionOf>, 'BB'>;
      const inRange = isInRange(RFI_RANGES[pos], human.hole[0], human.hole[1]);
      if (entry.action.type === 'raise' && !inRange) {
        flags.push({ actionIndex, kind: 'preflop-loose' });
      } else if (entry.action.type === 'fold' && inRange) {
        flags.push({ actionIndex, kind: 'preflop-tight' });
      } else if (entry.action.type === 'call' && !inRange) {
        flags.push({ actionIndex, kind: 'preflop-loose' });
      }
      // call (limp) in range → standard（不標記）; fold out of range → standard
      return;
    }

    // 翻牌後：只評跟注
    if (entry.action.type !== 'call') return;
    postflopCall++;
    const p = state.players.find((x) => x.seat === human.seat)!;
    const owe = state.currentBet - p.committed;
    // ponytail: 短籌碼 all-in call for less：截斷 owe 至實際可付金額，
    // 並以 level = totalCommitted+pay 截斷對手有效貢獻，避免高估 required equity
    const pay = Math.min(owe, p.stack);
    const level = p.totalCommitted + pay;
    const pot = state.players.reduce((s, x) => s + Math.min(x.totalCommitted, level), 0);
    const opponents = state.players.filter(
      (x) => x.seat !== human.seat && x.state !== 'folded',
    ).length;
    const required = pay / (pot + pay);
    const estimated = equity(human.hole, state.board, opponents, DEFAULT_ITERATIONS, rng);
    if (estimated < required - ODDS_BUFFER) {
      flags.push({
        actionIndex,
        kind: 'call-without-odds',
        detail: { requiredEquity: round3(required), estimatedEquity: round3(estimated) },
      });
    }
  });

  return { flags, opportunities: { rfi, postflopCall } };
}

// ── 彙總（holdem.reviewFlags v1）─────────────────────────────

export type FlagAggregates = Record<ReviewFlag['kind'], { count: number; opportunities: number }>;

export const EMPTY_AGGREGATES: FlagAggregates = {
  'preflop-loose': { count: 0, opportunities: 0 },
  'preflop-tight': { count: 0, opportunities: 0 },
  'call-without-odds': { count: 0, opportunities: 0 },
};

export const FLAGS_KEY = 'holdem.reviewFlags';
export const FLAGS_VERSION = 1;

// preflop-loose 與 preflop-tight 兩個 key 的 opportunities 都累加同一個 rfi 數；
// call-without-odds 的 opportunities 累加 postflopCall
export function accumulate(prev: FlagAggregates, result: GradeResult): FlagAggregates {
  const { flags, opportunities } = result;
  const countOf = (kind: ReviewFlag['kind']): number =>
    flags.filter((f) => f.kind === kind).length;
  return {
    'preflop-loose': {
      count: prev['preflop-loose'].count + countOf('preflop-loose'),
      opportunities: prev['preflop-loose'].opportunities + opportunities.rfi,
    },
    'preflop-tight': {
      count: prev['preflop-tight'].count + countOf('preflop-tight'),
      opportunities: prev['preflop-tight'].opportunities + opportunities.rfi,
    },
    'call-without-odds': {
      count: prev['call-without-odds'].count + countOf('call-without-odds'),
      opportunities: prev['call-without-odds'].opportunities + opportunities.postflopCall,
    },
  };
}
