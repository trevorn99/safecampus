import styles from "./charts.module.css";

export type EventTypeCount = { type: string; label: string; count: number };

const BAR_HEIGHT = 20;
const ROW_HEIGHT = 32;
const LABEL_COL = 72;
const CHART_WIDTH = 360;
const BAR_AREA = CHART_WIDTH - LABEL_COL - 40;
const RADIUS = 4;

// Right end rounded, left end square against the baseline — bar spec calls
// for a single rounded data-end, not a stadium shape.
function roundedBarPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(RADIUS, width / 2);
  if (width <= 0) return "";
  return [
    `M ${x} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${y + height - r}`,
    `Q ${x + width} ${y + height} ${x + width - r} ${y + height}`,
    `L ${x} ${y + height}`,
    "Z",
  ].join(" ");
}

export function EventTypeBarChart({ data }: { data: EventTypeCount[] }) {
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const height = data.length * ROW_HEIGHT + 16;

  return (
    <figure className={styles.chartFigure}>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${height}`}
        className={styles.chartSvg}
        role="img"
        aria-label={`Events by type: ${data.map((d) => `${d.label} ${d.count}`).join(", ")}`}
      >
        {data.map((d, i) => {
          const y = i * ROW_HEIGHT + 8;
          const barWidth = (d.count / maxCount) * BAR_AREA;
          return (
            <g key={d.type}>
              <text
                x={LABEL_COL - 10}
                y={y + BAR_HEIGHT / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className={styles.chartLabel}
              >
                {d.label}
              </text>
              {barWidth > 0 && (
                <path d={roundedBarPath(LABEL_COL, y, barWidth, BAR_HEIGHT)} className={styles[`series${(i % 4) + 1}`]}>
                  <title>{`${d.label}: ${d.count}`}</title>
                </path>
              )}
              <text
                x={LABEL_COL + barWidth + 8}
                y={y + BAR_HEIGHT / 2}
                dominantBaseline="middle"
                className={styles.chartValue}
              >
                {d.count}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
