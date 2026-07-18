import { useState } from 'react';
import type { Card } from '../../engine/deck';
import { cardToString } from '../../engine/deck';
import { best7, bestHand } from '../../engine/evaluator';
import { describeHand } from '../../engine/handNames';
import type { HandReadingPayload } from '../../trainers/handReading';
import type { QuizQuestion } from '../../trainers/types';
import { CardView } from '../table/CardView';
import styles from './quiz.module.css';

interface Props {
  question: QuizQuestion<HandReadingPayload>;
  onAnswer: (correct: boolean) => void;
  phase: 'answering' | 'feedback';
}

function CardRow({ cards, highlight }: { cards: readonly Card[]; highlight?: ReadonlySet<Card> }) {
  return (
    <div className={styles.cards}>
      {cards.map((c) => (
        <div key={c} className={highlight?.has(c) ? styles.cardHighlight : styles.cardWrap}>
          <CardView card={c} />
        </div>
      ))}
    </div>
  );
}

export function HandReadingQuiz({ question, onAnswer, phase }: Props) {
  const [chosen, setChosen] = useState<number | string | null>(null);
  const p = question.payload;

  if (p.kind === 'best') {
    const { answerIdx } = p;
    const feedback = phase === 'feedback' ? best7(p.cards) : null;
    const fiveSet = new Set(feedback?.five ?? []);

    function choose(idx: number) {
      if (phase !== 'answering' || chosen !== null) return;
      setChosen(idx);
      onAnswer(idx === answerIdx);
    }

    return (
      <div className={styles.container}>
        <p className={styles.prompt}>這 7 張牌的最佳牌型是？</p>
        <CardRow cards={p.cards} highlight={fiveSet} />
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
        {feedback && (
          <p className={styles.explain}>
            最佳牌型：「{describeHand(feedback.score)}」，組成五張：{feedback.five.map(cardToString).join(' ')}
          </p>
        )}
      </div>
    );
  }

  // kind === 'compare'
  const { answer } = p;
  const a = phase === 'feedback' ? bestHand([...p.holeA, ...p.board]) : null;
  const b = phase === 'feedback' ? bestHand([...p.holeB, ...p.board]) : null;
  const aFive = new Set(a?.five ?? []);
  const bFive = new Set(b?.five ?? []);

  const options: { label: string; value: 'A' | 'B' | 'tie' }[] = [
    { label: 'A 家較大', value: 'A' },
    { label: 'B 家較大', value: 'B' },
    { label: '平手', value: 'tie' },
  ];

  function chooseCompare(val: 'A' | 'B' | 'tie') {
    if (phase !== 'answering' || chosen !== null) return;
    setChosen(val);
    onAnswer(val === answer);
  }

  return (
    <div className={styles.container}>
      <p className={styles.prompt}>比較兩手牌，哪家較大？</p>
      <div className={styles.twoHands}>
        <div className={styles.handGroup}>
          <span className={styles.handLabel}>A 家</span>
          <CardRow cards={p.holeA} highlight={aFive} />
        </div>
        <div className={styles.handGroup}>
          <span className={styles.handLabel}>B 家</span>
          <CardRow cards={p.holeB} highlight={bFive} />
        </div>
      </div>
      <div className={styles.handGroup}>
        <span className={styles.handLabel}>公牌</span>
        <CardRow cards={p.board} highlight={new Set([...aFive, ...bFive])} />
      </div>
      <div className={styles.options}>
        {options.map(({ label, value }) => {
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
              onClick={() => chooseCompare(value)}
            >
              {label}
            </button>
          );
        })}
      </div>
      {a && b && (
        <p className={styles.explain}>
          A 家：{describeHand(a.score)}（{a.five.map(cardToString).join(' ')}）；
          B 家：{describeHand(b.score)}（{b.five.map(cardToString).join(' ')}）
          → {p.answer === 'tie' ? '兩家平手' : `${p.answer} 家較大`}
        </p>
      )}
    </div>
  );
}
