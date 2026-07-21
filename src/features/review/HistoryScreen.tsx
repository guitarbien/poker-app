import { useMemo, useState } from 'react';
import { loadHands } from '../../review/recorder';
import type { HandRecord } from '../../review/recorder';
import type { TrainerName } from '../../trainers/progress';
import { CardView } from '../table/CardView';
import { DashboardScreen } from './DashboardScreen';
import styles from './HistoryScreen.module.css';

interface Props {
  onBack: () => void;
  onReplay: (record: HandRecord) => void;
  onPractice?: (target: TrainerName) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function HistoryScreen({ onBack, onReplay, onPractice }: Props) {
  // 反序：最新在前
  const hands = useMemo(() => loadHands().slice().reverse(), []);
  const [tab, setTab] = useState<'history' | 'dashboard'>('history');

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← 返回</button>
        <div className={styles.tabs}>
          <button
            className={`${styles.tabBtn}${tab === 'history' ? ' ' + styles.tabActive : ''}`}
            onClick={() => setTab('history')}
          >手牌歷史</button>
          <button
            className={`${styles.tabBtn}${tab === 'dashboard' ? ' ' + styles.tabActive : ''}`}
            onClick={() => setTab('dashboard')}
            data-testid="tab-dashboard"
          >儀表板</button>
        </div>
      </div>

      {tab === 'dashboard' && <DashboardScreen onPractice={onPractice} />}

      {tab === 'history' && <div className={styles.listWrap}>
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
                role="button"
                tabIndex={0}
                onClick={() => onReplay(rec)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onReplay(rec);
                  }
                }}
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
      </div>}
    </div>
  );
}
