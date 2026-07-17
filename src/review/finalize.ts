import type { Rng } from '../engine/rng';
import type { GameState } from '../engine/game';
import { buildHandRecord, type HandLog, type HandRecord } from './recorder';
import { gradeHand, type GradeResult } from './grader';

export function finalizeHand(
  handLog: HandLog,
  final: GameState,
  timestamp: number,
  rng: Rng,
): { record: HandRecord; gradeResult: GradeResult } {
  const base = buildHandRecord(handLog, final, timestamp);
  const gradeResult = gradeHand(base, rng);
  const record = { ...base, flags: gradeResult.flags };
  return { record, gradeResult };
}
