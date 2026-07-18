import { loadProgress, type TrainerName } from '../../trainers/progress';
import { TRAINER_LABELS } from './QuizShell';
import styles from './TrainerMenu.module.css';

const TRAINER_DESCS: Record<TrainerName, string> = {
  handReading: '判斷七張牌的最佳牌型，或比較兩手牌哪家較大',
  potOdds: '依底池與跟注金額，計算跟注所需的最低勝率',
  preflopRange: '依位置決定是否開牌，對照 RFI 開牌範圍',
  equityGuess: '估算手牌對上明牌或範圍的勝率（±5% 內算對）',
};

const TRAINER_ORDER: TrainerName[] = ['handReading', 'potOdds', 'preflopRange', 'equityGuess'];

interface Props {
  onStart: (name: TrainerName, mode: 'practice' | 'review') => void;
  onBack: () => void;
}

export function TrainerMenu({ onStart, onBack }: Props) {
  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← 返回</button>
        <h1 className={styles.title}>訓練模組</h1>
      </div>
      <div className={styles.grid}>
        {TRAINER_ORDER.map((name) => {
          const p = loadProgress(name);
          const wrongCount = p.wrongBook.length;
          return (
            <div key={name} className={styles.card}>
              <h2 className={styles.cardTitle}>{TRAINER_LABELS[name]}</h2>
              <p className={styles.cardDesc}>{TRAINER_DESCS[name]}</p>
              <div className={styles.stats}>
                <span className={styles.statsRate}>正確率 {p.correct}/{p.asked}</span>
                {wrongCount > 0 && (
                  <span className={styles.wrongBadge} data-testid={`wrong-badge-${name}`}>
                    錯題 {wrongCount} 題
                  </span>
                )}
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.startBtn}
                  onClick={() => onStart(name, 'practice')}
                  data-testid={`start-${name}`}
                >
                  開始練習
                </button>
                <button
                  className={styles.reviewBtn}
                  disabled={wrongCount === 0}
                  onClick={() => onStart(name, 'review')}
                  data-testid={`review-${name}`}
                >
                  複習錯題
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
