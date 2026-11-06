import styles from "./charts.module.css";
import { roundedColumnPath } from "./paths";

// Sign-ins per day: one series, so the app accent and no legend — the card
// title says what's plotted. Only the busiest day carries a value label;
// every day has a hover tooltip on a hit area the full height of its slot,
// which is far easier to land on than a 12px column.
const WIDTH = 600;
const HEIGHT = 170;
const BASELINE_Y = HEIGHT - 24;
const MAX_BAR = BASELINE_Y - 26;
const BAR = 12;
const GAP = 6;

function label(day: string, style: "short" | "long"): string {
  // Noon, so the calendar day can't shift under a timezone conversion.
  const date = new Date(`${day}T12:00:00`);
  return style === "short"
    ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function DailySignInsChart({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const peak = data.reduce((best, d) => (d.count > best.count ? d : best), data[0] ?? { day: "", count: 0 });
  const startX = Math.max(8, (WIDTH - data.length * (BAR + GAP)) / 2 + GAP / 2);

  return (
    <figure className={`${styles.chartFigure} ${styles.chartFigureLatest}`}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={styles.chartSvg}
        role="img"
        aria-label={`Sign-ins per day: ${data.map((d) => `${label(d.day, "long")}, ${d.count}`).join("; ")}`}
      >
        <line x1={8} y1={BASELINE_Y} x2={WIDTH - 8} y2={BASELINE_Y} className={styles.chartBaseline} />
        {data.map((d, i) => {
          const x = startX + i * (BAR + GAP);
          const height = (d.count / max) * MAX_BAR;
          const isPeak = d.day === peak.day && d.count > 0;
          return (
            <g key={d.day}>
              <path d={roundedColumnPath(x, BASELINE_Y, BAR, height)} className={styles.seriesAccent} />
              {isPeak && (
                <text x={x + BAR / 2} y={BASELINE_Y - height - 6} textAnchor="middle" className={styles.chartValue}>
                  {d.count}
                </text>
              )}
              {/* Weekly date ticks, oldest on the left. */}
              {(data.length - 1 - i) % 7 === 0 && (
                <text x={x + BAR / 2} y={BASELINE_Y + 16} textAnchor="middle" className={styles.chartLabel}>
                  {label(d.day, "short")}
                </text>
              )}
              <rect x={x - GAP / 2} y={8} width={BAR + GAP} height={BASELINE_Y - 8} className={styles.hitArea}>
                <title>{`${label(d.day, "long")}: ${d.count} sign-in${d.count === 1 ? "" : "s"}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
