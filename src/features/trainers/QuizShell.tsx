import { useState } from 'react';
import type { ReactNode } from 'react';
import type { QuizQuestion } from '../../trainers/types';
import {
  loadProgress,
  recordAnswer,
  saveProgress,
  type TrainerName,
  type TrainerProgress,
} from '../../trainers/progress';
import styles from './QuizShell.module.css';

export const TRAINER_LABELS: Record<TrainerName, string> = {
  handReading: '牌型判讀',
  potOdds: '底池賠率',
  preflopRange: '起手牌範圍',
  equityGuess: 'Equity 估算',
};

export interface QuizShellProps {
  name: TrainerName;
  mode: 'practice' | 'review';
  generate: () => QuizQuestion<unknown>;
  renderBody: (
    question: QuizQuestion<unknown>,
    onAnswer: (correct: boolean) => void,
    phase: 'answering' | 'feedback',
  ) => ReactNode;
  onExit: () => void;
}

export function QuizShell({ name, mode, generate, renderBody, onExit }: QuizShellProps) {
  const [progress, setProgress] = useState<TrainerProgress>(() => loadProgress(name));
  const [reviewQueue, setReviewQueue] = useState<QuizQuestion<unknown>[]>(() =>
    mode === 'review' ? loadProgress(name).wrongBook.map((e) => e.question) : [],
  );
  const [question, setQuestion] = useState<QuizQuestion<unknown>>(() => {
    if (mode === 'review') {
      const wb = loadProgress(name).wrongBook;
      if (wb.length > 0) return wb[0].question;
    }
    return generate();
  });
  const [phase, setPhase] = useState<'answering' | 'feedback' | 'complete'>(() =>
    mode === 'review' && loadProgress(name).wrongBook.length === 0 ? 'complete' : 'answering',
  );
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionAsked, setSessionAsked] = useState(0);
  // 換題時重掛 quiz body（複習模式可能連續出同一題，靠 question.id 無法重置）
  const [round, setRound] = useState(0);

  function handleAnswer(correct: boolean) {
    const newProgress = recordAnswer(progress, question, correct);
    saveProgress(name, newProgress);
    setProgress(newProgress);
    setLastCorrect(correct);
    setSessionAsked((n) => n + 1);
    if (correct) setSessionCorrect((n) => n + 1);

    if (mode === 'review') {
      const stillIn = newProgress.wrongBook.some((e) => e.question.id === question.id);
      // FIFO 輪詢：仍在本中 → 移到隊尾；已移出 → 從清單消失
      setReviewQueue((q) => {
        const rest = q.filter((x) => x.id !== question.id);
        return stillIn ? [...rest, question] : rest;
      });
    }
    setPhase('feedback');
  }

  function handleNext() {
    if (mode === 'review') {
      if (reviewQueue.length === 0) {
        setPhase('complete');
        return;
      }
      setQuestion(reviewQueue[0]);
    } else {
      setQuestion(generate());
    }
    setRound((r) => r + 1);
    setPhase('answering');
    setLastCorrect(null);
  }

  if (phase === 'complete') {
    return (
      <div className={styles.shell}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>{TRAINER_LABELS[name]}</span>
          <button className={styles.exitBtn} onClick={onExit}>返回</button>
        </div>
        <div className={styles.complete}>
          <h2>複習完成！</h2>
          <p>錯題本已清空，本次答對 {sessionCorrect}/{sessionAsked} 題</p>
          <button className={styles.nextBtn} style={{ maxWidth: 240 }} onClick={onExit}>
            返回選單
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>{TRAINER_LABELS[name]}</span>
          <span className={styles.modeTag}>{mode === 'review' ? '複習' : '練習'}</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.headerScore} data-testid="quiz-score">
            本次 {sessionCorrect}/{sessionAsked}　累計 {progress.correct}/{progress.asked}
          </span>
          <button className={styles.exitBtn} onClick={onExit}>退出</button>
        </div>
      </div>
      <div className={styles.body}>
        {phase === 'feedback' && lastCorrect !== null && (
          <div
            className={`${styles.feedbackBanner} ${lastCorrect ? styles.correct : styles.incorrect}`}
            data-testid="feedback-banner"
            data-result={lastCorrect ? 'correct' : 'incorrect'}
          >
            {lastCorrect ? '✓ 正確！' : '✗ 答錯了'}
          </div>
        )}
        <div key={round}>{renderBody(question, handleAnswer, phase === 'feedback' ? 'feedback' : 'answering')}</div>
        {phase === 'feedback' && (
          <button className={styles.nextBtn} onClick={handleNext} data-testid="next-question-btn">
            {mode === 'review' && reviewQueue.length === 0 ? '完成' : '下一題'}
          </button>
        )}
      </div>
    </div>
  );
}
