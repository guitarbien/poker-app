import { useState } from 'react';
import type { Difficulty } from '../../engine/game';
import { loadSettings, saveSettings } from './settings';
import type { Settings } from './settings';
import type { SessionConfig } from '../table/session';
import styles from './HomeScreen.module.css';

interface Props {
  onStart: (config: SessionConfig) => void;
  onReview: () => void;
  onTrainers: () => void;
}

const BLINDS_OPTIONS = [
  { label: '1/2', sb: 1, bb: 2 },
  { label: '2/5', sb: 2, bb: 5 },
  { label: '5/10', sb: 5, bb: 10 },
] as const;

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
const DIFF_LABELS: Record<Difficulty, string> = { easy: '簡單', normal: '普通', hard: '困難' };

export function HomeScreen({ onStart, onReview, onTrainers }: Props) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  }

  function setCpuCount(count: number) {
    const diffs = [...settings.difficulties];
    while (diffs.length < count) diffs.push('easy');
    update({ cpuCount: count, difficulties: diffs.slice(0, count) });
  }

  function setAllDiff(d: Difficulty) {
    update({ difficulties: Array(settings.cpuCount).fill(d) as Difficulty[] });
  }

  function setCpuDiff(idx: number, d: Difficulty) {
    const diffs = [...settings.difficulties];
    diffs[idx] = d;
    update({ difficulties: diffs });
  }

  function handleStart() {
    onStart({
      cpuCount: settings.cpuCount,
      difficulties: settings.difficulties,
      blinds: settings.blinds,
    });
  }

  const allSameDiff = DIFFS.find((d) => settings.difficulties.every((x) => x === d));

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>德州撲克練習</h1>

      <div className={styles.form}>
        {/* 盲注等級 */}
        <div className={styles.row}>
          <span className={styles.label}>盲注等級</span>
          <div className={styles.btnGroup}>
            {BLINDS_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                className={`${styles.optBtn}${settings.blinds.bb === opt.bb ? ' ' + styles.active : ''}`}
                onClick={() => update({ blinds: { sb: opt.sb, bb: opt.bb } })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* CPU 數量 */}
        <div className={styles.row}>
          <span className={styles.label}>CPU 數量</span>
          <div className={styles.btnGroup}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`${styles.optBtn}${settings.cpuCount === n ? ' ' + styles.active : ''}`}
                onClick={() => setCpuCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* 難度設定 */}
        <div className={styles.diffSection}>
          <div className={styles.row}>
            <span className={styles.label}>全部難度</span>
            <div className={styles.btnGroup}>
              {DIFFS.map((d) => (
                <button
                  key={d}
                  className={`${styles.optBtn}${allSameDiff === d ? ' ' + styles.active : ''}`}
                  onClick={() => setAllDiff(d)}
                >
                  {DIFF_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
          {settings.difficulties.map((d, i) => (
            <div key={i} className={`${styles.row} ${styles.cpuRow}`}>
              <span className={styles.label}>CPU {i + 1}</span>
              <div className={styles.btnGroup}>
                {DIFFS.map((opt) => (
                  <button
                    key={opt}
                    className={`${styles.optBtn} ${styles.small}${d === opt ? ' ' + styles.active : ''}`}
                    onClick={() => setCpuDiff(i, opt)}
                  >
                    {DIFF_LABELS[opt]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.btnRow}>
        <button className={styles.startBtn} onClick={handleStart}>
          開始牌局
        </button>
        <button className={`${styles.startBtn} ${styles.secondary}`} onClick={onReview}>
          檢討
        </button>
        <button className={`${styles.startBtn} ${styles.secondary}`} onClick={onTrainers}>
          訓練
        </button>
      </div>
    </div>
  );
}
