import { useState } from 'react';
import type { PotOddsPayload } from '../../trainers/potOdds';
import { explainPotOdds } from '../../trainers/potOdds';
import type { QuizQuestion } from '../../trainers/types';
import styles from './quiz.module.css';

interface Props {
  question: QuizQuestion<PotOddsPayload>;
  onAnswer: (correct: boolean) => void;
  phase: 'answering' | 'feedback';
}

export function PotOddsQuiz({ question, onAnswer, phase }: Props) {
  const [chosen, setChosen] = useState<number | null>(null);
  const p = question.payload;

  function choose(idx: number) {
    if (phase !== 'answering' || chosen !== null) return;
    setChosen(idx);
    onAnswer(idx === p.answerIdx);
  }

  return (
    <div className={styles.container}>
      <p className={styles.prompt}>需要多少勝率才值得跟注？</p>
      <div className={styles.contextCard}>
        <div className={styles.contextRow}>
          <span className={styles.contextLabel}>底池大小</span>
          <strong>{p.pot}</strong>
        </div>
        <div className={styles.contextRow}>
          <span className={styles.contextLabel}>需跟注</span>
          <strong>{p.call}</strong>
        </div>
      </div>
      <div className={styles.options}>
        {p.options.map((opt, idx) => {
          let cls = styles.optBtn;
          if (phase === 'feedback') {
            if (idx === p.answerIdx) cls += ' ' + styles.optBtnCorrect;
            else if (chosen === idx) cls += ' ' + styles.optBtnWrong;
          }
          return (
            <button
              key={idx}
              className={cls}
              disabled={phase === 'feedback'}
              data-correct={String(idx === p.answerIdx)}
              data-testid={`answer-btn-${idx}`}
              onClick={() => choose(idx)}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {phase === 'feedback' && <p className={styles.explain} data-testid="explanation">{explainPotOdds(p)}</p>}
    </div>
  );
}
