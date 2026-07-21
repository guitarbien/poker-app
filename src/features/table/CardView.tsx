import type { Card } from '../../engine/deck';
import { cardToString } from '../../engine/deck';
import styles from './CardView.module.css';

const SUIT_SYMBOLS: Record<string, string> = { h: '♥', d: '♦', s: '♠', c: '♣' };
const SUIT_NAMES: Record<string, string> = { h: '紅心', d: '方塊', s: '黑桃', c: '梅花' };

interface Props {
  card?: Card;
  faceDown?: boolean;
}

export function CardView({ card, faceDown }: Props) {
  if (faceDown || card === undefined) {
    return <div className={styles.cardBack} role="img" aria-label="蓋牌" />;
  }
  const str = cardToString(card);
  const rank = str[0];
  const suit = str[1];
  const isRed = suit === 'h' || suit === 'd';
  return (
    <div
      className={`${styles.card} ${isRed ? styles.red : styles.black}`}
      role="img"
      aria-label={`${SUIT_NAMES[suit]}${rank}`}
    >
      <span className={styles.rank} aria-hidden="true">{rank}</span>
      <span className={styles.suit} aria-hidden="true">{SUIT_SYMBOLS[suit]}</span>
    </div>
  );
}
