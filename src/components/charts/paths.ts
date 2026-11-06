// A column with a 4px rounded data-end and a square foot on the baseline —
// the mark spec every column chart here follows.
export function roundedColumnPath(x: number, baselineY: number, width: number, height: number, radius = 4): string {
  if (height <= 0) return "";
  const r = Math.min(radius, height / 2, width / 2);
  const top = baselineY - height;
  return [
    `M ${x} ${baselineY}`,
    `L ${x} ${top + r}`,
    `Q ${x} ${top} ${x + r} ${top}`,
    `L ${x + width - r} ${top}`,
    `Q ${x + width} ${top} ${x + width} ${top + r}`,
    `L ${x + width} ${baselineY}`,
    "Z",
  ].join(" ");
}
