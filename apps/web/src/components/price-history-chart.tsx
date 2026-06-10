import type { PriceHistory } from '@/lib/types';
import { usd } from '@/lib/format';

/** Minimal dependency-free SVG line chart for price history. */
export function PriceHistoryChart({ history }: { history: PriceHistory }) {
  const points = history.points ?? [];
  if (points.length < 2) {
    return <p className="text-sm text-muted-foreground">Not enough price history yet.</p>;
  }

  const values = points.map((p) => Number(p.priceUsd));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 600;
  const H = 160;
  const pad = 8;

  const coords = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = coords.join(' ');
  const area = `${pad},${H - pad} ${line} ${W - pad},${H - pad}`;

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Last {history.days} days</span>
        <span className="font-medium text-success">Lowest {usd(history.lowestUsd)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Price history chart">
        <polygon points={area} fill="hsl(var(--primary))" opacity="0.08" />
        <polyline
          points={line}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{usd(max)} high</span>
        <span>{usd(min)} low</span>
      </div>
    </div>
  );
}
