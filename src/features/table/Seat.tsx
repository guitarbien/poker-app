import type { Player } from '../../engine/game';
import type { Position } from '../../engine/ranges';
import { CardView } from './CardView';
import styles from './Seat.module.css';

interface Props {
  player: Player;
  isButton: boolean;
  isToAct: boolean;
  showHole: boolean;
  position: Position;
}

export function Seat({ player, isButton, isToAct, showHole, position }: Props) {
  const isFolded = player.state === 'folded';
  const isAllIn = player.state === 'allin';
  const isHuman = !player.isCpu;

  const className = [
    styles.seat,
    isFolded ? styles.folded : '',
    isToAct ? styles.toAct : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={className} data-testid="seat">
      {player.committed > 0 && (
        <div className={styles.committed}>{player.committed}</div>
      )}
      <div className={styles.avatar}>
        {isHuman ? '你' : `S${player.seat}`}
      </div>
      <div className={styles.info}>
        <span className={styles.position}>{position}</span>
        {isButton && <span className={styles.dealer}>D</span>}
        {isAllIn && <span className={styles.allIn}>ALL-IN</span>}
        <span className={styles.stack}>{player.stack}</span>
      </div>
      <div className={styles.cards}>
        {showHole && player.hole ? (
          <>
            <CardView card={player.hole[0]} />
            <CardView card={player.hole[1]} />
          </>
        ) : (
          <>
            <CardView faceDown />
            <CardView faceDown />
          </>
        )}
      </div>
    </div>
  );
}
