import { useMemo } from 'react';
import { loadHands } from '../../review/recorder';
import type { HandRecord } from '../../review/recorder';
import { CardView } from '../table/CardView';
import styles from './HistoryScreen.module.css';

interface Props {
  onBack: () => void;
  onReplay: (record: HandRecord) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function HistoryScreen({ onBack, onReplay }: Props) {
  // 反序：最新在前
  const hands = useMemo(() => loadHands().slice().reverse(), []);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← 返回</button>
        <h1 className={styles.title}>手牌歷史</h1>
      </div>

      <div className={styles.listWrap}>
        {hands.length === 0 ? (
          <div className={styles.empty}>
            <p>尚無歷史記錄</p>
            <p>先打幾手再來檢討吧！</p>
          </div>
        ) : (
          hands.map((rec) => {
            const flagCount = rec.flags.length;
            const hasFlagRow = flagCount > 0;
            const human = rec.players.find((p) => !p.isCpu);
            return (
              <div
                key={`${rec.handNumber}-${rec.timestamp}`}
                className={`${styles.row}${hasFlagRow ? ' ' + styles.rowFlagged : ''}`}
                onClick={() => onReplay(rec)}
              >
                <div className={styles.meta}>
                  <span className={styles.handNum}>第 {rec.handNumber} 手</span>
                  <span className={styles.time}>{formatTime(rec.timestamp)}</span>
                </div>
                <div className={styles.hole}>
                  {human?.hole ? (
                    <>
                      <CardView card={human.hole[0]} />
                      <CardView card={human.hole[1]} />
                    </>
                  ) : null}
                </div>
                <div
                  className={`${styles.net} ${rec.humanNet > 0 ? styles.netPos : rec.humanNet < 0 ? styles.netNeg : styles.netZero}`}
                >
                  {rec.humanNet > 0 ? '+' : ''}{rec.humanNet}
                </div>
                {hasFlagRow && (
                  <div className={styles.flagBadge}>⚑ {flagCount}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
