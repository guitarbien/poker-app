import { describe, expect, it } from 'vitest';
import type { KVStore } from '../storage/storage';
import type { QuizQuestion } from './types';
import {
  EMPTY_PROGRESS,
  loadProgress,
  recordAnswer,
  saveProgress,
  trainerKey,
  type TrainerProgress,
} from './progress';

function memStore(init: Record<string, string> = {}): KVStore {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

const q1: QuizQuestion<unknown> = { id: 'q1', payload: {} };
const q2: QuizQuestion<unknown> = { id: 'q2', payload: {} };

describe('progress', () => {
  describe('trainerKey', () => {
    it('返回正確的 key 格式', () => {
      expect(trainerKey('handReading')).toBe('holdem.trainer.handReading');
      expect(trainerKey('potOdds')).toBe('holdem.trainer.potOdds');
    });
  });

  describe('EMPTY_PROGRESS', () => {
    it('不被 recordAnswer 汙染', () => {
      const before = JSON.stringify(EMPTY_PROGRESS);
      recordAnswer(EMPTY_PROGRESS, q1, false);
      const after = JSON.stringify(EMPTY_PROGRESS);
      expect(before).toBe(after);
    });
  });

  describe('recordAnswer', () => {
    it('答錯 → 入錯題本，asked/correct 累計', () => {
      let p: TrainerProgress = { asked: 0, correct: 0, wrongBook: [] };
      p = recordAnswer(p, q1, false);
      expect(p.asked).toBe(1);
      expect(p.correct).toBe(0);
      expect(p.wrongBook).toHaveLength(1);
      expect(p.wrongBook[0]).toEqual({ question: q1, consecutiveCorrect: 0 });
    });

    it('答對不在本中的題目 → asked/correct 累計，不進本', () => {
      let p: TrainerProgress = { asked: 0, correct: 0, wrongBook: [] };
      p = recordAnswer(p, q1, true);
      expect(p.asked).toBe(1);
      expect(p.correct).toBe(1);
      expect(p.wrongBook).toHaveLength(0);
    });

    it('答對在本中的同題 → consecutiveCorrect+1', () => {
      let p: TrainerProgress = {
        asked: 0,
        correct: 0,
        wrongBook: [{ question: q1, consecutiveCorrect: 0 }],
      };
      p = recordAnswer(p, q1, true);
      expect(p.asked).toBe(1);
      expect(p.correct).toBe(1);
      expect(p.wrongBook[0].consecutiveCorrect).toBe(1);
    });

    it('連續兩次答對在本中的題 → 移出', () => {
      let p: TrainerProgress = {
        asked: 0,
        correct: 0,
        wrongBook: [{ question: q1, consecutiveCorrect: 1 }],
      };
      p = recordAnswer(p, q1, true);
      expect(p.asked).toBe(1);
      expect(p.correct).toBe(1);
      expect(p.wrongBook).toHaveLength(0);
    });

    it('答錯在本中的題 → consecutiveCorrect 歸零', () => {
      let p: TrainerProgress = {
        asked: 0,
        correct: 0,
        wrongBook: [{ question: q1, consecutiveCorrect: 1 }],
      };
      p = recordAnswer(p, q1, false);
      expect(p.asked).toBe(1);
      expect(p.correct).toBe(0);
      expect(p.wrongBook[0].consecutiveCorrect).toBe(0);
    });

    it('多題混合場景', () => {
      let p: TrainerProgress = { asked: 0, correct: 0, wrongBook: [] };

      // 答錯 q1, q2
      p = recordAnswer(p, q1, false);
      p = recordAnswer(p, q2, false);
      expect(p.wrongBook).toHaveLength(2);
      expect(p.asked).toBe(2);
      expect(p.correct).toBe(0);

      // 答對 q1 (第一次)
      p = recordAnswer(p, q1, true);
      expect(p.asked).toBe(3);
      expect(p.correct).toBe(1);
      expect(p.wrongBook).toHaveLength(2);
      expect(p.wrongBook[0].consecutiveCorrect).toBe(1);
      expect(p.wrongBook[1].question.id).toBe('q2');

      // 答對 q1 (第二次) → 移出
      p = recordAnswer(p, q1, true);
      expect(p.asked).toBe(4);
      expect(p.correct).toBe(2);
      expect(p.wrongBook).toHaveLength(1);
      expect(p.wrongBook[0].question.id).toBe('q2');

      // 答對 q2 (第一次)
      p = recordAnswer(p, q2, true);
      expect(p.asked).toBe(5);
      expect(p.correct).toBe(3);
      expect(p.wrongBook[0].consecutiveCorrect).toBe(1);
    });
  });

  describe('load/save', () => {
    it('saveProgress 後 loadProgress 取回原資料', () => {
      const s = memStore();
      const p: TrainerProgress = {
        asked: 10,
        correct: 5,
        wrongBook: [{ question: q1, consecutiveCorrect: 1 }],
      };
      saveProgress('handReading', p, s);
      const loaded = loadProgress('handReading', s);
      expect(loaded).toEqual(p);
    });

    it('不存在或版本不符 → loadProgress 回傳 EMPTY_PROGRESS 副本', () => {
      const s = memStore();
      const loaded = loadProgress('potOdds', s);
      expect(loaded).toEqual({ asked: 0, correct: 0, wrongBook: [] });
      expect(loaded).not.toBe(EMPTY_PROGRESS); // 應是副本
    });

    it('多個 trainer 各自獨立存儲', () => {
      const s = memStore();
      const p1: TrainerProgress = { asked: 1, correct: 0, wrongBook: [] };
      const p2: TrainerProgress = { asked: 2, correct: 1, wrongBook: [] };
      saveProgress('handReading', p1, s);
      saveProgress('potOdds', p2, s);
      expect(loadProgress('handReading', s)).toEqual(p1);
      expect(loadProgress('potOdds', s)).toEqual(p2);
    });

    it('TRAINER_VERSION 改變 → 舊資料視為無效', () => {
      const s = memStore();
      const p: TrainerProgress = { asked: 10, correct: 5, wrongBook: [] };
      const key = trainerKey('handReading');
      // 模擬舊版本資料
      s.setItem(key, JSON.stringify({ version: 0, data: p }));
      const loaded = loadProgress('handReading', s);
      // 版本不符應回傳 EMPTY_PROGRESS
      expect(loaded).toEqual({ asked: 0, correct: 0, wrongBook: [] });
    });
  });
});
