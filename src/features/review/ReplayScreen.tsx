import { useState, useMemo } from 'react';
import type { HandRecord } from '../../review/recorder';
import { replayStates } from '../../review/replay';
import type { GameState } from '../../engine/game';
import { CardView } from '../table/CardView';
import styles from './ReplayScreen.module.css';

const STREET_LABELS: Record<string, string> = {
  preflop: '翻前',
  flop: '翻牌',
  turn: '轉牌',
  river: '河牌',
};

const FLAG_KIND_LABELS: Record<string, string> = {
  'preflop-loose': '翻前過鬆',
  'preflop-tight': '翻前過緊',
  'call-without-odds': '賠率不足跟注',
};

function actionDesc(entry: HandRecord['actions'][number], state: GameState): string {
  const isCpu = state.players.find((p) => p.seat === entry.seat)?.isCpu ?? true;
  const who = isCpu ? `座位 ${entry.seat}` : '你';
  const { action } = entry;
  switch (action.type) {
    case 'fold': return `${who} 棄牌`;
    case 'check': return `${who} 過牌`;
    case 'call': return `${who} 跟注`;
    case 'raise': return `${who} 加注到 ${action.to}`;
  }
}

interface Props {
  record: HandRecord;
  onBack: () => void;
}

export function ReplayScreen({ record, onBack }: Props) {
  const states = useMemo(() => replayStates(record), [record]);
  const [stepIdx, setStepIdx] = useState(() =>
    record.flags.length > 0 ? record.flags[0].actionIndex + 1 : 0,
  );
  const [forceShow, setForceShow] = useState(false);

  const maxStep = record.actions.length;
  const currentState: GameState = states[stepIdx];
  const currentEntry = stepIdx > 0 ? record.actions[stepIdx - 1] : null;
  const currentFlag = currentEntry
    ? record.flags.find((f) => f.actionIndex === stepIdx - 1)
    : null;

  // 攤牌亮牌：∃ winner.handRank !== null → 亮終局所有非 folded 玩家（含輸家）
  const hasShowdown = record.potResults.some((pr) =>
    pr.winners.some((w) => w.handRank !== null),
  );
  const finalState = states[states.length - 1];

  function shouldReveal(seat: number): boolean {
    if (forceShow) return true;
    // human 永遠看到自己的底牌；隱藏規則只限未攤牌的 CPU 底牌
    if (!record.players.find((p) => p.seat === seat)?.isCpu) return true;
    if (hasShowdown) {
      const p = finalState.players.find((x) => x.seat === seat);
      return p !== undefined && p.state !== 'folded';
    }
    return false;
  }

  // 各街道第一個動作的 step (1-based index into actions → stepIdx)
  const streetSteps = useMemo<Partial<Record<string, number>>>(() => {
    const map: Partial<Record<string, number>> = {};
    record.actions.forEach((e, i) => {
      if (!(e.street in map)) map[e.street] = i + 1;
    });
    return map;
  }, [record]);

  const STREETS = ['preflop', 'flop', 'turn', 'river'] as const;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← 返回</button>
        <span className={styles.title}>第 {record.handNumber} 手回放</span>
      </div>

      <div className={styles.body}>
        {/* 公共牌 */}
        <div className={styles.board}>
          {currentState.board.map((c, i) => (
            <CardView key={i} card={c} />
          ))}
          {Array.from({ length: Math.max(0, 5 - currentState.board.length) }).map((_, i) => (
            <CardView key={`empty-${i}`} />
          ))}
        </div>

        {/* 玩家座位 */}
        <div className={styles.players}>
          {currentState.players.map((p) => {
            const isFolded = p.state === 'folded';
            const isToAct = currentState.toAct === p.seat;
            const reveal = shouldReveal(p.seat);
            return (
              <div
                key={p.seat}
                className={[
                  styles.playerCard,
                  isFolded ? styles.folded : '',
                  isToAct ? styles.toAct : '',
                ].filter(Boolean).join(' ')}
              >
                <div className={styles.playerName}>
                  {p.isCpu ? `座位 ${p.seat}` : '你'}
                  {currentState.button === p.seat ? ' D' : ''}
                </div>
                <div className={styles.playerStack}>{p.stack}</div>
                <div className={styles.holeRow}>
                  {p.hole ? (
                    reveal ? (
                      <>
                        <CardView card={p.hole[0]} />
                        <CardView card={p.hole[1]} />
                      </>
                    ) : (
                      <>
                        <CardView faceDown />
                        <CardView faceDown />
                      </>
                    )
                  ) : (
                    <>
                      <CardView faceDown />
                      <CardView faceDown />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 動作描述 */}
        <div className={styles.actionDesc}>
          {currentEntry ? (
            <>
              <span>{actionDesc(currentEntry, states[stepIdx - 1])}</span>
              {currentFlag && (
                <span className={styles.flagBadge}>
                  ⚑ {FLAG_KIND_LABELS[currentFlag.kind] ?? currentFlag.kind}
                </span>
              )}
            </>
          ) : stepIdx === 0 ? (
            <span>手牌開始</span>
          ) : (
            <span>手牌結束</span>
          )}
          {currentFlag?.detail && (
            <div className={styles.flagDetail}>
              需要勝率 {(currentFlag.detail.requiredEquity! * 100).toFixed(1)}%，
              估計 {(currentFlag.detail.estimatedEquity! * 100).toFixed(1)}%
            </div>
          )}
        </div>

        {/* 控制列 */}
        <div className={styles.controls}>
          <div className={styles.navRow}>
            <button
              className={styles.stepBtn}
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              disabled={stepIdx === 0}
            >上一步</button>
            <span className={styles.stepInfo}>{stepIdx} / {maxStep}</span>
            <button
              className={styles.stepBtn}
              onClick={() => setStepIdx((i) => Math.min(maxStep, i + 1))}
              disabled={stepIdx === maxStep}
            >下一步</button>
          </div>

          <div className={styles.streetRow}>
            {STREETS.map((s) => {
              const stepForStreet = streetSteps[s];
              const isActive = currentEntry
                ? currentEntry.street === s
                : stepIdx === 0 && s === 'preflop';
              return (
                <button
                  key={s}
                  className={`${styles.streetBtn}${isActive ? ' ' + styles.active : ''}`}
                  onClick={() => stepForStreet !== undefined && setStepIdx(stepForStreet)}
                  disabled={stepForStreet === undefined}
                >
                  {STREET_LABELS[s]}
                </button>
              );
            })}
          </div>

          <div className={styles.toggleRow}>
            <button
              className={`${styles.toggleBtn}${forceShow ? ' ' + styles.on : ''}`}
              onClick={() => setForceShow((v) => !v)}
            >
              {forceShow ? '隱藏底牌' : '顯示所有底牌'}
            </button>
          </div>
        </div>

        {/* Flag 跳轉列 */}
        {record.flags.length > 0 && (
          <div className={styles.flagList}>
            <div className={styles.flagListTitle}>標記動作（點擊跳至）</div>
            {record.flags.map((flag, fi) => (
              <div key={fi} className={styles.flagItem}>
                <span className={styles.flagKind}>
                  步驟 {flag.actionIndex + 1}：{FLAG_KIND_LABELS[flag.kind] ?? flag.kind}
                  {flag.detail
                    ? `（需 ${(flag.detail.requiredEquity! * 100).toFixed(1)}% / 估 ${(flag.detail.estimatedEquity! * 100).toFixed(1)}%）`
                    : ''}
                </span>
                <button
                  className={styles.jumpBtn}
                  onClick={() => setStepIdx(flag.actionIndex + 1)}
                >跳至</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
