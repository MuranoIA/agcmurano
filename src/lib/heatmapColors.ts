function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function rgb(r: number, g: number, b: number) {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

// Zero: #F0EEEE
// Below TM: orange dark #C55A11 -> orange light #FCE4D6
// At/above TM: blue light #BDD7EE -> blue dark #1F4E79
export function heatmapColor(value: number, tmMes: number): { bg: string; fg: string } {
  if (value === 0 || !tmMes) return { bg: "#F0EEEE", fg: "#999" };

  if (value < tmMes) {
    const t = Math.min(value / tmMes, 1);
    // t=0 -> dark orange, t=1 -> light orange
    const r = lerp(197, 252, t), g = lerp(90, 228, t), b = lerp(17, 214, t);
    return { bg: rgb(r, g, b), fg: t < 0.5 ? "#fff" : "#7c2d12" };
  }

  const t = Math.min((value / tmMes - 1), 1); // 0 at TM, 1 at 2x TM
  // t=0 -> light blue, t=1 -> dark blue
  const r = lerp(189, 31, t), g = lerp(215, 78, t), b = lerp(238, 121, t);
  return { bg: rgb(r, g, b), fg: t > 0.4 ? "#fff" : "#1e3a5f" };
}
