import styles from "./charts.module.css";
import { roundedColumnPath } from "./paths";

export type WeeklyFillRate = { weekStart: string; filled: number; total: number; rate: number };

const CHART_WIDTH = 480;
const CHART_HEIGHT = 160;
const BASELINE_Y = CHART_HEIGHT - 24;
const BAR_MAX_HEIGHT = BASELINE_Y - 24;
const BAR_WIDTH = 24;
const GAP = 10;

function weekLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function FillRateChart({ data }: { data: WeeklyFillRate[] }) {
  const totalContentWidth = data.length * (BAR_WIDTH + GAP);
  const startX = Math.max(16, (CHART_WIDTH - totalContentWidth) / 2 + GAP / 2);

  return (
    <figure className={`${styles.chartFigure} ${styles.chartFigureLatest}`}>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className={styles.chartSvg}
        role="img"
        aria-label={`Weekly scheduling fill rate: ${data.map((d) => `week of ${weekLabel(d.weekStart)}, ${Math.round(d.rate * 100)} percent`).join(", ")}`}
      >
        <line x1={16} y1={BASELINE_Y} x2={CHART_WIDTH - 16} y2={BASELINE_Y} className={styles.chartBaseline} />
        {data.map((d, i) => {
          const x = startX + i * (BAR_WIDTH + GAP);
          const height = d.total > 0 ? d.rate * BAR_MAX_HEIGHT : 0;
          const pct = Math.round(d.rate * 100);
          return (
            <g key={d.weekStart}>
              {height > 0 && (
                <path d={roundedColumnPath(x, BASELINE_Y, BAR_WIDTH, height)} className={styles.seriesAccent}>
                  <title>{`Week of ${weekLabel(d.weekStart)}: ${d.filled} of ${d.total} slots filled (${pct}%)`}</title>
                </path>
              )}
              <text x={x + BAR_WIDTH / 2} y={BASELINE_Y - height - 6} textAnchor="middle" className={styles.chartValue}>
                {d.total > 0 ? `${pct}%` : "—"}
              </text>
              <text x={x + BAR_WIDTH / 2} y={BASELINE_Y + 16} textAnchor="middle" className={styles.chartLabel}>
                {weekLabel(d.weekStart)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
