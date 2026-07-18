import styles from './RangeMatrix.module.css';

interface Cell {
  label: string;
  inRange: boolean;
  isCurrent: boolean;
}

interface Props {
  matrix: Cell[][];
}

export function RangeMatrix({ matrix }: Props) {
  return (
    <div className={styles.grid} role="grid" aria-label="起手牌範圍矩陣">
      {matrix.map((row, i) =>
        row.map((cell, j) => (
          <div
            key={`${i}-${j}`}
            role="gridcell"
            className={[
              styles.cell,
              cell.inRange ? styles.inRange : '',
              cell.isCurrent ? styles.current : '',
            ]
              .filter(Boolean)
              .join(' ')}
            title={cell.label}
          >
            {cell.label}
          </div>
        )),
      )}
    </div>
  );
}
