export function usd(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function money(value: string | number, symbol: string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return `${symbol}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)}`;
}

export function rating(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return n.toFixed(1);
}

export function availabilityLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');
}
