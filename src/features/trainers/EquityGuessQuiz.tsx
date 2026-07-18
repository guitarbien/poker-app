import { useState } from 'react';
import type { EquityGuessPayload } from '../../trainers/equityGuess';
import { judgeEquityGuess } from '../../trainers/equityGuess';
import type { QuizQuestion } from '../../trainers/types';
import { CardView } from '../table/CardView';
import styles from './quiz.module.css';

interface Props {
  question: QuizQuestion<EquityGuessPayload>;
  onAnswer: (correct: boolean) => void;
  phase: 'answering' | 'feedback';
}

const BOARD_LABELS: Record<number, string> = { 0: '翻牌前', 3: '翻牌（Flop）', 4: '轉牌（Turn）' };

export function EquityGuessQuiz({ question, onAnswer, phase }: Props) {
  const [guess, setGuess] = useState('');
  // 判定一次保留 actual：同題重判 MC 會漂移 ±1pp，±5 邊界附近會翻轉
  const [result, setResult] = useState<{ actual: number; correct: boolean; guess: number } | null>(null);
  const p = question.payload;

  function handleSubmit() {
    if (phase !== 'answering' || result !== null) return;
    const g = Number(guess);
    if (!Number.isFinite(g) || g < 0 || g > 100) return;
    // 同步判定（2000 次 MC 約數十毫秒）；spec 明定不做「計算中」文案
    const r = judgeEquityGuess(p, g, Math.random);
    setResult({ ...r, guess: g });
    onAnswer(r.correct);
  }

  return (
    <div className={styles.container}>
      <p className={styles.prompt}>估算你的勝率（誤差 ±5% 內算對）</p>

      <div className={styles.twoHands}>
        <div className={styles.handGroup}>
          <span className={styles.handLabel}>你的手牌</span>
          <div className={styles.cards}>
            {p.hole.map((c) => (
              <div key={c} className={styles.cardWrap}><CardView card={c} /></div>
            ))}
          </div>
        </div>
        <div className={styles.handGroup}>
          <span className={styles.handLabel}>對手</span>
          {p.opponent.kind === 'hand' ? (
            <div className={styles.cards}>
              {p.opponent.hole.map((c) => (
                <div key={c} className={styles.cardWrap}><CardView card={c} /></div>
              ))}
            </div>
          ) : (
            <div>
              <span className={styles.badge}>{p.opponent.name}</span>
              <div className={styles.rangeStr}>{p.opponent.range}</div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.handGroup}>
        <span className={styles.handLabel}>{BOARD_LABELS[p.board.length]}</span>
        {p.board.length > 0 && (
          <div className={styles.cards}>
            {p.board.map((c) => (
              <div key={c} className={styles.cardWrap}><CardView card={c} /></div>
            ))}
          </div>
        )}
      </div>

      {phase === 'answering' ? (
        <div className={styles.equityInput}>
          <input
            type="number"
            min={0}
            max={100}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="0–100"
            aria-label="勝率估計（百分比）"
            data-testid="equity-input"
          />
          <span style={{ color: '#a0b4c4' }}>%</span>
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={guess === '' || !Number.isFinite(Number(guess))}
            data-testid="equity-submit"
          >
            作答
          </button>
        </div>
      ) : (
        result && (
          <p className={styles.explain}>
            你估 {result.guess}%，實際勝率 {(result.actual * 100).toFixed(1)}%，
            誤差 {Math.abs(result.guess - result.actual * 100).toFixed(1)} 個百分點（±5 內算對）
          </p>
        )
      )}
    </div>
  );
}
