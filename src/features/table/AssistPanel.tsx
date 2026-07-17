import { useMemo } from 'react';
import type { GameState } from '../../engine/game';
import { legalActions } from '../../engine/game';
import { equity } from '../../engine/equity';
import { bestHand } from '../../engine/evaluator';
import { handClassOf } from '../../engine/ranges';
import { describeHand } from './handNames';
import styles from './AssistPanel.module.css';

interface Props {
  game: GameState;
  enabled: boolean;
  onToggle: () => void;
}

export function AssistPanel({ game, enabled, onToggle }: Props) {
  const human = game.players.find((p) => !p.isCpu);
  const activeOpponents = game.players.filter((p) => p.isCpu && p.state !== 'folded').length;

  // 只在街道改變或對手棄牌時重算；下注動作不觸發；disabled 時跳過運算
  // ponytail: useMemo deps 對應 brief spec §7
  const equityVal = useMemo(() => {
    if (!enabled) return null;
    if (!human?.hole || activeOpponents === 0 || game.street === 'handOver') return null;
    return equity(human.hole, game.board, activeOpponents, 2000, Math.random);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, game.handNumber, game.street, activeOpponents]);

  // 底池賠率：輪到玩家且 owe > 0
  const potOdds = useMemo(() => {
    if (!human || game.toAct !== human.seat) return null;
    const la = legalActions(game);
    if (!la.call) return null;
    const callAmt = la.call.amount;
    const pot = game.players.reduce((s, p) => s + p.totalCommitted, 0);
    const required = callAmt / (callAmt + pot);
    return { callAmt, pot, required };
  }, [game]);

  // 目前成牌：preflop 顯示手牌類，postflop 顯示 describeHand
  const currentHand = useMemo(() => {
    if (!human?.hole || game.street === 'handOver') return null;
    if (game.street === 'preflop') return handClassOf(human.hole[0], human.hole[1]);
    if (game.board.length < 3) return null;
    const { score } = bestHand([...human.hole, ...game.board]);
    return describeHand(score);
  }, [game.street, human?.hole, game.board]);

  return (
    <div className={styles.panel} data-testid="assist-panel">
      <div className={styles.header}>
        <span className={styles.title}>練習輔助</span>
        <button className={styles.toggleBtn} onClick={onToggle}>
          {enabled ? '關閉輔助' : '開啟輔助'}
        </button>
      </div>
      {enabled && (
        <div className={styles.body}>
          {equityVal !== null && (
            <div className={styles.row}>
              <span className={styles.label}>勝率（vs 隨機手牌）</span>
              <span className={styles.value} data-testid="assist-equity">
                {(equityVal * 100).toFixed(1)}%
              </span>
            </div>
          )}
          {potOdds && (
            <div className={styles.row}>
              <span className={styles.label}>底池賠率</span>
              <span className={styles.value} data-testid="assist-pot-odds">
                跟注 {potOdds.callAmt} ／ 底池 {potOdds.pot} ＝ 需要 {(potOdds.required * 100).toFixed(1)}% 勝率
              </span>
            </div>
          )}
          {currentHand && (
            <div className={styles.row}>
              <span className={styles.label}>目前成牌</span>
              <span className={styles.value} data-testid="assist-hand">
                {currentHand}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
