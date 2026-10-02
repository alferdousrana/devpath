// Lightweight responsive SVG charts (no library, scales via viewBox).
import { esc } from "./ui.js";

export function barChart(data, { height = 160, unit = "", max = null, title = "Bar chart" } = {}) {
  const w = Math.max(280, data.length * 40), h = height, pad = 22;
  const m = max ?? Math.max(1, ...data.map((d) => d.value));
  const bw = (w - pad * 2) / data.length;
  const bars = data.map((d, i) => {
    const bh = ((h - pad * 2) * d.value) / m;
    const x = pad + i * bw + bw * 0.18, y = h - pad - bh;
    return `<g><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(bh, d.value ? 2 : 0).toFixed(1)}" rx="3" class="bar${d.highlight ? " hl" : ""}"><title>${esc(d.label)}: ${d.value}${unit}</title></rect>
      <text x="${(x + bw * 0.32).toFixed(1)}" y="${h - 6}" class="axis" text-anchor="middle">${esc(d.short ?? d.label)}</text>
      ${d.value ? `<text x="${(x + bw * 0.32).toFixed(1)}" y="${(y - 5).toFixed(1)}" class="val" text-anchor="middle">${d.value}</text>` : ""}</g>`;
  }).join("");
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}" preserveAspectRatio="xMidYMid meet">${bars}</svg>`;
}

export function lineChart(points, { height = 170, max = 100, unit = "%", title = "Line chart", threshold = null } = {}) {
  if (!points.length) return "";
  const w = 520, h = height, px = 30, py = 20;
  const xs = (i) => px + (points.length === 1 ? (w - px * 2) / 2 : (i * (w - px * 2)) / (points.length - 1));
  const ys = (v) => h - py - ((h - py * 2) * v) / max;
  const d = points.map((p, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${ys(p.value).toFixed(1)}`).join(" ");
  const grid = [0, 50, 100].map((g) => `<line x1="${px}" x2="${w - px}" y1="${ys(g)}" y2="${ys(g)}" class="grid"/><text x="4" y="${ys(g) + 4}" class="axis">${g}</text>`).join("");
  const th = threshold != null ? `<line x1="${px}" x2="${w - px}" y1="${ys(threshold)}" y2="${ys(threshold)}" class="threshold"/>` : "";
  const dots = points.map((p, i) => `<circle cx="${xs(i).toFixed(1)}" cy="${ys(p.value).toFixed(1)}" r="4" class="dot${p.bad ? " bad" : ""}"><title>${esc(p.label)}: ${p.value}${unit}</title></circle>`).join("");
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">${grid}${th}<path d="${d}" class="line"/>${dots}</svg>`;
}
