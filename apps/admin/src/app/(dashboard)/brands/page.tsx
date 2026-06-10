'use client';

import { useCallback, useEffect, useState } from 'react';
import { authFetch, API_URL } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

interface Brand {
  id: string;
  name: string;
  slug: string;
  websiteUrl?: string | null;
  productCount: number;
  isActive: boolean;
}

export default function BrandsPage() {
  const { can } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/v1/brands`);
      setBrands(await res.json());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await authFetch('/admin/brands', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          slug: fd.get('slug'),
          websiteUrl: fd.get('websiteUrl') || undefined,
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
    if (!confirm('Soft-delete this brand?')) return;
    try {
      await authFetch(`/admin/brands/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Brands</h1>

      {can('brand.create') && (
        <form onSubmit={create} className="card mt-4 grid gap-4 p-5 sm:grid-cols-4">
          <div>
            <label className="label">Name</label>
            <input name="name" required className="input" />
          </div>
          <div>
            <label className="label">Slug</label>
            <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="input" />
          </div>
          <div>
            <label className="label">Website</label>
            <input name="websiteUrl" type="url" className="input" />
          </div>
          <div className="flex items-end">
            <button disabled={busy} className="btn-primary w-full">
              {busy ? 'Saving…' : '+ Add brand'}
            </button>
          </div>
          {error && <p className="text-sm text-[hsl(var(--danger))] sm:col-span-4">{error}</p>}
        </form>
      )}

      <div className="card mt-4 overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="th">Name</th>
              <th className="th">Slug</th>
              <th className="th">Products</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id}>
                <td className="td font-medium">{b.name}</td>
                <td className="td text-muted-foreground">{b.slug}</td>
                <td className="td">{b.productCount}</td>
                <td className="td text-right">
                  {can('brand.delete') && (
                    <button
                      className="btn-danger !px-2 !py-1 text-xs"
                      onClick={() => void remove(b.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {brands.length === 0 && (
              <tr>
                <td className="td text-muted-foreground" colSpan={4}>
                  No brands yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
