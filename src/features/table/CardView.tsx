import type { Card } from '../../engine/deck';
import { cardToString } from '../../engine/deck';
import styles from './CardView.module.css';

const SUIT_SYMBOLS: Record<string, string> = { h: '♥', d: '♦', s: '♠', c: '♣' };

interface Props {
  card?: Card;
  faceDown?: boolean;
}

export function CardView({ card, faceDown }: Props) {
  if (faceDown || card === undefined) {
    return <div className={styles.cardBack} />;
  }
  const str = cardToString(card);
  const rank = str[0];
  const suit = str[1];
  const isRed = suit === 'h' || suit === 'd';
  return (
    <div className={`${styles.card} ${isRed ? styles.red : styles.black}`}>
      <span className={styles.rank}>{rank}</span>
      <span className={styles.suit}>{SUIT_SYMBOLS[suit]}</span>
    </div>
  );
}
