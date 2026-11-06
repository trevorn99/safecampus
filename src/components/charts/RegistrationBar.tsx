import styles from "./charts.module.css";

export type RegistrationPart = { key: string; name: string; count: number; slot: 1 | 2 | 3 };

// One roster split into where each person is in joining: a tall segmented
// bar (28px, 4px corners, 2px surface gap between blocks), each block's
// count printed inside in white when the block is wide enough to hold it.
// The legend names the parts in block order; the member list below the
// chart is the table view that carries every figure, including any a block
// was too narrow to print.
// Below this share a block is too narrow on a phone to hold its number.
const MIN_LABEL_SHARE = 0.12;

export function RegistrationBar({ parts }: { parts: RegistrationPart[] }) {
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  const shown = parts.filter((part) => part.count > 0);
  if (total === 0) return null;

  const describe = (part: RegistrationPart) =>
    `${part.name}: ${part.count} (${Math.round((part.count / total) * 100)}%)`;

  return (
    <figure className={styles.chartFigure}>
      <div className={styles.segmentBar} role="img" aria-label={`Registration: ${parts.map(describe).join(", ")}`}>
        {shown.map((part) => (
          <div
            key={part.key}
            className={`${styles.segment} ${styles[`segment${part.slot}`]}`}
            // Width from the count alone: a zero basis keeps the printed
            // number from widening its own block.
            style={{ flex: `${part.count} 1 0` }}
            title={describe(part)}
            tabIndex={0}
            aria-label={describe(part)}
          >
            {part.count / total >= MIN_LABEL_SHARE && <span className={styles.segmentValue}>{part.count}</span>}
          </div>
        ))}
      </div>
      <figcaption className={styles.legend}>
        {parts.map((part) => (
          <span key={part.key} className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles[`segment${part.slot}`]}`} aria-hidden="true" />
            {part.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
