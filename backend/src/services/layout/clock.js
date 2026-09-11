'use strict';

function clockGeometry(clock) {
  const point = (angle, radius) => ({ x: 60 + Math.sin(angle) * radius, y: 60 - Math.cos(angle) * radius });
  return {
    ticks: Array.from({ length: 60 }, (_, i) => ({ from: point(i * Math.PI / 30, i % 5 ? 49 : 46), to: point(i * Math.PI / 30, 52) })),
    numbers: Array.from({ length: 12 }, (_, i) => ({ ...point((i + 1) * Math.PI / 6, 38), text: String(i + 1) })),
    hour: point(((clock.hour % 12) + clock.minute / 60) * Math.PI / 6, 27),
    minute: point(clock.minute * Math.PI / 30, 43),
  };
}

function clockSvg(clock) {
  const g = clockGeometry(clock);
  const line = (a, b, w) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#222" stroke-width="${w}" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="white" stroke="#222" stroke-width="1.5"/>${g.ticks.map((t) => line(t.from, t.to, 0.7)).join('')}${g.numbers.map((n) => `<text x="${n.x}" y="${n.y + 3.5}" text-anchor="middle" font-family="sans-serif" font-size="10">${n.text}</text>`).join('')}${clock.blank ? '' : line({ x: 60, y: 60 }, g.hour, 2.8) + line({ x: 60, y: 60 }, g.minute, 1.5)}<circle cx="60" cy="60" r="2" fill="#222"/></svg>`;
}

module.exports = { clockGeometry, clockSvg };
