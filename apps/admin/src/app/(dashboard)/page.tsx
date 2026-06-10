'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

interface Analytics {
  rangeDays: number;
  clicks: number;
  revenueUsd: number;
  conversions: number;
  epc: number;
  conversionRate: number;
  byStore: { storeId: string; clicks: number; revenueUsd: number }[];
  byDevice: { device: string; clicks: number }[];
}

export default function OverviewPage() {
  const { user, can } = useAuth();
  const [stats, setStats] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!can('affiliate.view')) return;
    authFetch<Analytics>('/admin/affiliate/analytics?days=30')
      .then(setStats)
      .catch((e) => setError((e as Error).message));
  }, [can]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Welcome back, {user?.fullName ?? user?.email}.
      </p>

      {!can('affiliate.view') ? (
        <p className="card mt-6 p-6 text-sm text-muted-foreground">
          Your role has no analytics access.
        </p>
      ) : error ? (
        <p className="card mt-6 p-6 text-sm text-[hsl(var(--danger))]">
          Could not load analytics: {error}
        </p>
      ) : !stats ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading analytics…</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label={`Clicks (${stats.rangeDays}d)`} value={stats.clicks.toLocaleString()} />
            <Kpi label="Revenue" value={`$${stats.revenueUsd.toLocaleString()}`} />
            <Kpi label="EPC" value={`$${stats.epc.toFixed(4)}`} />
            <Kpi label="Conversion rate" value={`${(stats.conversionRate * 100).toFixed(2)}%`} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <BreakdownCard
              title="Clicks by device"
              rows={stats.byDevice.map((d) => ({ label: d.device, value: d.clicks }))}
            />
            <BreakdownCard
              title="Clicks by store"
              rows={stats.byStore.map((s) => ({
                label: s.storeId.slice(0, 8),
                value: s.clicks,
                extra: `$${s.revenueUsd.toFixed(2)}`,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; extra?: string }[];
}) {
  return (
    <div className="card p-5">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between">
              <span className="capitalize">{row.label}</span>
              <span className="font-medium">
                {row.value.toLocaleString()}
                {row.extra && <span className="ml-2 text-muted-foreground">{row.extra}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
