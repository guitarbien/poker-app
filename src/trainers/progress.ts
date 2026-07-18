import type { KVStore } from '../storage/storage';
import { load, save } from '../storage/storage';
import type { QuizQuestion } from './types';

export type TrainerName = 'handReading' | 'potOdds' | 'preflopRange' | 'equityGuess';

export interface WrongEntry<TPayload = unknown> {
  question: QuizQuestion<TPayload>;
  consecutiveCorrect: number; // 連續答對數；達 2 移出；答錯歸零
}

export interface TrainerProgress {
  asked: number;
  correct: number;
  wrongBook: WrongEntry[];
}

export const EMPTY_PROGRESS: TrainerProgress = { asked: 0, correct: 0, wrongBook: [] };

export function trainerKey(name: TrainerName): string {
  return `holdem.trainer.${name}`;
}

export const TRAINER_VERSION = 1;

export function loadProgress(name: TrainerName, store?: KVStore): TrainerProgress {
  return load(trainerKey(name), TRAINER_VERSION, structuredClone(EMPTY_PROGRESS), store);
}

export function saveProgress(name: TrainerName, p: TrainerProgress, store?: KVStore): void {
  save(trainerKey(name), TRAINER_VERSION, p, store);
}

// 純函式：一次作答後的新進度（含錯題本進出邏輯）
// 答錯 → 入錯題本（已在本中則 consecutiveCorrect 歸零）
// 答對且在本中 → consecutiveCorrect+1，達 2 移出；不在本中則錯題本不變
export function recordAnswer(
  p: TrainerProgress,
  q: QuizQuestion<unknown>,
  correct: boolean,
): TrainerProgress {
  const idx = p.wrongBook.findIndex((e) => e.question.id === q.id);
  let wrongBook: WrongEntry[];
  if (!correct) {
    wrongBook =
      idx >= 0
        ? p.wrongBook.map((e, i) => (i === idx ? { ...e, consecutiveCorrect: 0 } : e))
        : [...p.wrongBook, { question: q, consecutiveCorrect: 0 }];
  } else if (idx >= 0) {
    const n = p.wrongBook[idx].consecutiveCorrect + 1;
    wrongBook =
      n >= 2
        ? p.wrongBook.filter((_, i) => i !== idx)
        : p.wrongBook.map((e, i) => (i === idx ? { ...e, consecutiveCorrect: n } : e));
  } else {
    wrongBook = p.wrongBook;
  }
  return { asked: p.asked + 1, correct: p.correct + (correct ? 1 : 0), wrongBook };
}
