import { load } from '../../storage/storage';
import { STATS_KEY, STATS_VERSION, EMPTY_STATS } from '../../stats/stats';
import type { Stats } from '../../stats/stats';
import { FLAGS_KEY, FLAGS_VERSION, EMPTY_AGGREGATES } from '../../review/grader';
import type { FlagAggregates } from '../../review/grader';
import styles from './DashboardScreen.module.css';

function pct(num: number, den: number): string {
  if (den === 0) return '—';
  return `${Math.round((num / den) * 100)}%`;
}

const KIND_LABEL: Record<keyof FlagAggregates, string> = {
  'preflop-loose': '翻牌前開牌過鬆',
  'preflop-tight': '翻牌前過緊',
  'call-without-odds': '賠率不足跟注',
};

const KIND_UNIT: Record<keyof FlagAggregates, string> = {
  'preflop-loose': 'RFI 決策',
  'preflop-tight': 'RFI 決策',
  'call-without-odds': '翻牌後跟注',
};

const KIND_ORDER: (keyof FlagAggregates)[] = ['preflop-loose', 'preflop-tight', 'call-without-odds'];

export function DashboardScreen() {
  const stats: Stats = load(STATS_KEY, STATS_VERSION, EMPTY_STATS);
  const flags: FlagAggregates = load(FLAGS_KEY, FLAGS_VERSION, EMPTY_AGGREGATES);

  return (
    <div className={styles.wrap}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>戰績</h2>
        <div className={styles.statGrid}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>手數</span>
            <span className={styles.statVal} data-testid="stat-hands">{stats.handsPlayed}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>總損益</span>
            <span
              className={`${styles.statVal} ${stats.totalWinnings > 0 ? styles.pos : stats.totalWinnings < 0 ? styles.neg : ''}`}
              data-testid="stat-winnings"
            >
              {stats.totalWinnings > 0 ? '+' : ''}{stats.totalWinnings}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>VPIP</span>
            <span className={styles.statVal} data-testid="stat-vpip">{pct(stats.vpipHands, stats.handsPlayed)}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>PFR</span>
            <span className={styles.statVal} data-testid="stat-pfr">{pct(stats.pfrHands, stats.handsPlayed)}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>攤牌勝率</span>
            <span className={styles.statVal} data-testid="stat-showdown">{pct(stats.showdownsWon, stats.showdownsSeen)}</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>弱點分析</h2>
        {KIND_ORDER.map((kind) => {
          const { count, opportunities } = flags[kind];
          const noData = opportunities === 0;
          return (
            <div key={kind} className={styles.weakRow} data-testid={`weak-${kind}`}>
              <div className={styles.weakInfo}>
                {noData ? (
                  <span className={styles.weakLabel}>
                    {KIND_LABEL[kind]}：<span className={styles.noData}>尚無資料</span>
                  </span>
                ) : (
                  <span className={styles.weakLabel}>
                    {KIND_LABEL[kind]}：{pct(count, opportunities)}（{count}/{opportunities} 次 {KIND_UNIT[kind]}）
                  </span>
                )}
              </div>
              <button
                className={styles.practiceBtn}
                disabled
                title="訓練模組即將推出"
              >
                去練習
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
