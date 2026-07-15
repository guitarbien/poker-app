import type { SessionConfig } from '../table/session';
import styles from './HomeScreen.module.css';

interface Props {
  onStart: (config: SessionConfig) => void;
}

const SESSION_CONFIG: SessionConfig = {
  cpuCount: 5,
  cpuDifficulty: 'easy',
  blinds: { sb: 1, bb: 2 },
};

export function HomeScreen({ onStart }: Props) {
  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>德州撲克練習</h1>
      <button className={styles.startBtn} onClick={() => onStart(SESSION_CONFIG)}>
        開始牌局
      </button>
    </div>
  );
}
