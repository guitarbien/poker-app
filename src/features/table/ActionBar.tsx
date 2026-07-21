import { useState, useEffect } from 'react';
import type { Action, GameState, LegalActions } from '../../engine/game';
import styles from './ActionBar.module.css';

interface Props {
  game: GameState;
  legalActions: LegalActions;
  onAction: (action: Action) => void;
}

export function ActionBar({ game, legalActions: la, onAction }: Props) {
  const pot = game.players.reduce((s, p) => s + p.totalCommitted, 0);
  const minRaise = la.raise?.min ?? 0;
  const maxRaise = la.raise?.max ?? 0;

  const [raiseAmount, setRaiseAmount] = useState(minRaise);

  useEffect(() => {
    setRaiseAmount(minRaise);
  }, [minRaise, maxRaise]);

  const isCpuTurn = game.toAct !== null &&
    (game.players.find((p) => p.seat === game.toAct)?.isCpu ?? false);

  const disabled = isCpuTurn;

  function clampRaise(v: number): number {
    return Math.min(maxRaise, Math.max(minRaise, v));
  }

  function quickAmount(f: number): number {
    return clampRaise(game.currentBet + Math.floor(pot * f));
  }

  if (!la.fold && !la.check && !la.call && !la.raise) return null;

  return (
    <div className={styles.bar}>
      {la.fold && (
        <button disabled={disabled} onClick={() => onAction({ type: 'fold' })}>棄牌</button>
      )}
      {la.check && (
        <button disabled={disabled} onClick={() => onAction({ type: 'check' })}>過牌</button>
      )}
      {la.call && (
        <button disabled={disabled} onClick={() => onAction({ type: 'call' })}>
          跟注 {la.call.amount}
        </button>
      )}
      {la.raise && (
        <div className={styles.raiseSection}>
          <input
            type="range"
            min={minRaise}
            max={maxRaise}
            value={raiseAmount}
            disabled={disabled}
            aria-label="加注金額滑桿"
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
          />
          <input
            type="number"
            min={minRaise}
            max={maxRaise}
            value={raiseAmount}
            disabled={disabled}
            aria-label="加注金額"
            onChange={(e) => setRaiseAmount(clampRaise(Number(e.target.value)))}
          />
          <div className={styles.quickBtns}>
            <button disabled={disabled} onClick={() => setRaiseAmount(minRaise)}>最小</button>
            <button disabled={disabled} onClick={() => setRaiseAmount(quickAmount(0.5))}>½池</button>
            <button disabled={disabled} onClick={() => setRaiseAmount(quickAmount(0.667))}>⅔池</button>
            <button disabled={disabled} onClick={() => setRaiseAmount(quickAmount(1))}>滿池</button>
            <button disabled={disabled} onClick={() => setRaiseAmount(maxRaise)}>全下</button>
          </div>
          <button disabled={disabled} onClick={() => onAction({ type: 'raise', to: raiseAmount })}>
            加注 {raiseAmount}
          </button>
        </div>
      )}
    </div>
  );
}
