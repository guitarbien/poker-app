import type { Rng } from '../engine/rng';
import type { QuizQuestion } from './types';

export interface PotOddsPayload {
  pot: number;
  call: number;
  options: string[]; // 正解 + 三個干擾，顯示為整數百分比
  answerIdx: number;
  required: number; // 精確值（0–1），解說用
}

const POTS = Array.from({ length: 19 }, (_, i) => 20 + i * 10); // 20..200
const RATIOS = [1 / 4, 1 / 3, 1 / 2, 2 / 3, 1];
// 干擾項網格：步距 5，範圍 10..65（正解值域 20–50%，兩端各留餘裕）
const GRID = Array.from({ length: 12 }, (_, i) => 10 + i * 5); // {10,15,...,65}

export function potOddsId(p: { pot: number; call: number }): string {
  return `po:${p.pot},${p.call}`;
}

// 拆出讓測試能窮舉所有 pot/call 組合
export function makePotOddsQuestion(pot: number, call: number, rng: Rng): QuizQuestion<PotOddsPayload> {
  const required = call / (pot + call);
  const correctPct = Math.round(required * 100);
  const pool = GRID.filter((g) => Math.abs(g - correctPct) >= 5);
  // 從 pool 抽 3 個不重複
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const values = [correctPct, ...shuffled.slice(0, 3)];
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  const payload: PotOddsPayload = {
    pot,
    call,
    options: values.map((v) => `約 ${v}%`),
    answerIdx: values.indexOf(correctPct),
    required,
  };
  return { id: potOddsId(payload), payload };
}

export function generatePotOdds(rng: Rng): QuizQuestion<PotOddsPayload> {
  const pot = POTS[Math.floor(rng() * POTS.length)];
  const call = Math.round(pot * RATIOS[Math.floor(rng() * RATIOS.length)]);
  return makePotOddsQuestion(pot, call, rng);
}

export function explainPotOdds(p: PotOddsPayload): string {
  const pct = (p.required * 100).toFixed(1);
  return `跟注 ${p.call} ÷（底池 ${p.pot} + 跟注 ${p.call}）= ${pct}%，勝率高於此值才值得跟注`;
}
