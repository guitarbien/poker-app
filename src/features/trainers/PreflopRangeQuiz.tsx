import { useState } from 'react';
import type { PreflopRangePayload } from '../../trainers/preflopRange';
import { rangeMatrix } from '../../trainers/preflopRange';
import type { QuizQuestion } from '../../trainers/types';
import { CardView } from '../table/CardView';
import { RangeMatrix } from './RangeMatrix';
import styles from './quiz.module.css';

interface Props {
  question: QuizQuestion<PreflopRangePayload>;
  onAnswer: (correct: boolean) => void;
  phase: 'answering' | 'feedback';
}

const POSITION_LABELS: Record<string, string> = {
  UTG: 'UTG（最早位）',
  MP: 'MP（中間位）',
  CO: 'CO（切位）',
  BTN: 'BTN（按鈕位）',
  SB: 'SB（小盲位）',
};

const OPTIONS: { label: string; value: 'open' | 'fold' }[] = [
  { label: '開牌', value: 'open' },
  { label: '棄牌', value: 'fold' },
];

export function PreflopRangeQuiz({ question, onAnswer, phase }: Props) {
  const [chosen, setChosen] = useState<'open' | 'fold' | null>(null);
  const p = question.payload;

  function choose(val: 'open' | 'fold') {
    if (phase !== 'answering' || chosen !== null) return;
    setChosen(val);
    onAnswer(val === p.answer);
  }

  return (
    <div className={styles.container}>
      <p className={styles.prompt}>依位置決定：開牌或棄牌？</p>
      <div className={styles.contextRow}>
        <span className={styles.contextLabel}>位置</span>
        <span className={styles.badge}>{POSITION_LABELS[p.position] ?? p.position}</span>
      </div>
      <div className={styles.cards}>
        {p.hole.map((c) => (
          <div key={c} className={styles.cardWrap}>
            <CardView card={c} />
          </div>
        ))}
      </div>
      <div className={styles.options}>
        {OPTIONS.map(({ label, value }) => {
          let cls = styles.optBtn;
          if (phase === 'feedback') {
            if (value === p.answer) cls += ' ' + styles.optBtnCorrect;
            else if (chosen === value) cls += ' ' + styles.optBtnWrong;
          }
          return (
            <button
              key={value}
              className={cls}
              disabled={phase === 'feedback'}
              data-correct={String(value === p.answer)}
              data-testid={`answer-btn-${value}`}
              onClick={() => choose(value)}
            >
              {label}
            </button>
          );
        })}
      </div>
      {phase === 'feedback' && (
        <>
          <p className={styles.explain}>
            {p.position} 位應{p.answer === 'open' ? '開牌' : '棄牌'}
            （這手牌{p.answer === 'open' ? '在' : '不在'}開牌範圍內），範圍如下：
          </p>
          <RangeMatrix matrix={rangeMatrix(p.position, p.hole)} />
        </>
      )}
    </div>
  );
}
