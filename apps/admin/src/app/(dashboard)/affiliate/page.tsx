'use client';

import { useCallback, useEffect, useState } from 'react';
import { authFetch, API_URL } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

interface AffiliateLink {
  id: string;
  label?: string | null;
  targetUrl: string;
  shortCode?: string | null;
  affiliateTag?: string | null;
  isActive: boolean;
  store: { id: string; name: string };
}

interface Option {
  id: string;
  name: string;
}

export default function AffiliatePage() {
  const { can } = useAuth();
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [stores, setStores] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLinks(await authFetch<AffiliateLink[]>('/admin/affiliate-links'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    authFetch<Option[]>('/admin/stores').then(setStores).catch(() => undefined);
  }, [load]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await authFetch('/admin/affiliate-links', {
        method: 'POST',
        body: JSON.stringify({
          storeId: fd.get('storeId'),
          label: fd.get('label') || undefined,
          targetUrl: fd.get('targetUrl'),
          affiliateTag: fd.get('affiliateTag') || undefined,
        }),
      });
      form.reset();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this affiliate link?')) return;
    try {
      await authFetch(`/admin/affiliate-links/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Affiliate Links</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Short links redirect via <code className="rounded bg-muted px-1">/go/&lt;code&gt;</code> with
        async click tracking. Analytics on the Overview page.
      </p>

      {can('affiliate.create') && (
        <form onSubmit={create} className="card mt-4 grid gap-4 p-5 sm:grid-cols-4">
          <div>
            <label className="label">Store</label>
            <select name="storeId" required className="input">
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Label</label>
            <input name="label" className="input" placeholder="S25 Ultra @ Amazon US" />
          </div>
          <div>
            <label className="label">Target URL</label>
            <input name="targetUrl" type="url" required className="input" />
          </div>
          <div>
            <label className="label">Affiliate tag</label>
            <input name="affiliateTag" className="input" placeholder="ggph-20" />
          </div>
          {error && <p className="text-sm text-[hsl(var(--danger))] sm:col-span-4">{error}</p>}
          <div className="sm:col-span-4">
            <button disabled={busy} className="btn-primary">
              {busy ? 'Saving…' : '+ Create link'}
            </button>
          </div>
        </form>
      )}

      <div className="card mt-4 overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="th">Short link</th>
              <th className="th">Store</th>
              <th className="th">Label</th>
              <th className="th">Target</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.id}>
                <td className="td">
                  {link.shortCode ? (
                    <a
                      href={`${API_URL}/go/${link.shortCode}`}
                      target="_blank"
                      rel="noopener"
                      className="font-mono text-primary hover:underline"
                    >
                      /go/{link.shortCode}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="td">{link.store?.name}</td>
                <td className="td">{link.label ?? '—'}</td>
                <td className="td max-w-[260px] truncate text-muted-foreground">{link.targetUrl}</td>
                <td className="td text-right">
                  {can('affiliate.delete') && (
                    <button
                      className="btn-danger !px-2 !py-1 text-xs"
                      onClick={() => void remove(link.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {links.length === 0 && (
              <tr>
                <td className="td text-muted-foreground" colSpan={5}>
                  No affiliate links yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
