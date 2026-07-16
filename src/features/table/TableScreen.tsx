import { useState, useEffect } from 'react';
import type { Action } from '../../engine/game';
import { legalActions, positionOf } from '../../engine/game';
import type { TableState } from './useTable';
import { CardView } from './CardView';
import { Seat } from './Seat';
import { ActionBar } from './ActionBar';
import { AssistPanel } from './AssistPanel';
import { handName } from './handNames';
import { BUY_IN_BB } from './session';
import { loadSettings, saveSettings } from '../home/settings';
import styles from './TableScreen.module.css';

// Seat positions around the oval (clockwise from bottom, seat 0 = human)
const SEAT_POS = [
  { left: '50%', top: '90%' },  // 0: bottom centre (human)
  { left: '10%', top: '74%' },  // 1: left-lower
  { left: '10%', top: '26%' },  // 2: left-upper
  { left: '50%', top: '8%'  },  // 3: top centre
  { left: '90%', top: '26%' },  // 4: right-upper
  { left: '90%', top: '74%' },  // 5: right-lower
];

interface Props {
  state: TableState;
  onAction: (action: Action) => void;
  onNextHand: () => void;
  onRebuyAndNext: () => void;
  onExit: () => void;
}

const STREET_NAMES: Record<string, string> = {
  preflop: '翻牌前',
  flop: '翻牌',
  turn: '轉牌',
  river: '河牌',
};

const AUTO_NEXT_SECS = 5;

export function TableScreen({ state, onAction, onNextHand, onRebuyAndNext, onExit }: Props) {
  const { game, humanBusted } = state;

  // 練習輔助開關，持久化至 settings
  const [assistEnabled, setAssistEnabled] = useState(() => loadSettings().assistEnabled);

  function handleToggleAssist() {
    setAssistEnabled((prev) => {
      const next = !prev;
      const s = loadSettings();
      saveSettings({ ...s, assistEnabled: next });
      return next;
    });
  }

  // 自動下一手倒數（handOver 且未破產時才啟動）
  const isHandOver = game?.street === 'handOver';
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!isHandOver || humanBusted) {
      setCountdown(null);
      return;
    }
    setCountdown(AUTO_NEXT_SECS);
    const iv = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(iv);
          onNextHand();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHandOver, humanBusted, game?.handNumber]);

  if (!game) return null;

  const pot = game.players.reduce((s, p) => s + p.totalCommitted, 0);

  // Show hole cards for non-folded players when it was a showdown
  const isShowdown = game.result?.some((r) => r.winners.some((w) => w.handRank !== null)) ?? false;

  const la = isHandOver ? null : legalActions(game);
  const hasActions = la !== null && (la.fold || la.check || la.call !== null || la.raise !== null);

  // 補碼按鈕：handOver、非破產、0 < stack < 買入
  const human = game.players.find((p) => !p.isCpu);
  const buyIn = BUY_IN_BB * game.blinds.bb;
  const showRebuy = isHandOver && !humanBusted && human && human.stack > 0 && human.stack < buyIn;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <span>手牌 #{game.handNumber}</span>
        <span>盲注 {game.blinds.sb}/{game.blinds.bb}</span>
        <button className={styles.exitBtn} onClick={onExit} data-testid="exit-btn">
          離開
        </button>
      </div>

      <div className={styles.arena}>
        {/* CPU seats — desktop: absolute around oval; mobile: horizontal strip at top */}
        <div className={styles.opponentStrip}>
          {game.players.filter((p) => p.isCpu).map((player) => {
            const pos = SEAT_POS[player.seat];
            const showHole = isHandOver ? isShowdown && player.state !== 'folded' : false;
            return (
              <div
                key={player.seat}
                className={styles.seatWrap}
                style={{ left: pos.left, top: pos.top }}
              >
                <Seat
                  player={player}
                  isButton={player.seat === game.button}
                  isToAct={player.seat === game.toAct}
                  showHole={showHole}
                  position={positionOf(game, player.seat)}
                />
              </div>
            );
          })}
        </div>

        <div className={styles.table}>
          <div className={styles.board}>
            {game.board.map((card, i) => (
              <CardView key={i} card={card} />
            ))}
          </div>
          <div className={styles.pot}>彩池 {pot}</div>
          <div className={styles.handNumber}>{isHandOver ? '' : STREET_NAMES[game.street] ?? ''}</div>
        </div>

        {/* Human seat — desktop: absolute at bottom; mobile: above action bar */}
        {game.players.filter((p) => !p.isCpu).map((player) => {
          const pos = SEAT_POS[player.seat];
          const showHole = isHandOver ? isShowdown && player.state !== 'folded' : true;
          return (
            <div
              key={player.seat}
              className={`${styles.seatWrap} ${styles.humanSeat}`}
              style={{ left: pos.left, top: pos.top }}
            >
              <Seat
                player={player}
                isButton={player.seat === game.button}
                isToAct={player.seat === game.toAct}
                showHole={showHole}
                position={positionOf(game, player.seat)}
              />
            </div>
          );
        })}
      </div>

      <div className={styles.footer}>
        {isHandOver && game.result && (
          <div className={styles.result}>
            {game.result.map((potResult) =>
              potResult.winners.map((winner) => (
                <div key={`${potResult.potIndex}-${winner.seat}`} className={styles.resultLine}>
                  {winner.handRank === null
                    ? `全員棄牌：座位 ${winner.seat} 贏得 ${winner.amount}`
                    : `座位 ${winner.seat} 以 ${handName(winner.handRank)} 贏得 ${winner.amount}`}
                </div>
              ))
            )}
            <div className={styles.resultActions}>
              {!humanBusted && (
                <button onClick={() => { setCountdown(null); onNextHand(); }} data-testid="next-hand-btn">
                  下一手{countdown !== null ? `（${countdown}）` : ''}
                </button>
              )}
              {showRebuy && (
                <button onClick={onRebuyAndNext} data-testid="rebuy-btn">
                  補碼
                </button>
              )}
              {humanBusted && (
                <>
                  <button onClick={onRebuyAndNext}>重買</button>
                  <button onClick={onExit}>離開牌桌</button>
                </>
              )}
            </div>
          </div>
        )}

        <AssistPanel game={game} enabled={assistEnabled} onToggle={handleToggleAssist} />

        {hasActions && (
          <ActionBar game={game} legalActions={la} onAction={onAction} />
        )}
      </div>
    </div>
  );
}
