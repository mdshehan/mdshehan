'use client';

import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  status: string;
  minPriceUsd: string | null;
  brand: { id: string; name: string };
  category: { id: string; name: string };
  updatedAt: string;
}

interface Brand {
  id: string;
  name: string;
}
interface Category {
  id: string;
  name: string;
  children?: Category[];
}

export default function ProductsPage() {
  const { can } = useAuth();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query = '') => {
    try {
      setProducts(
        await authFetch<AdminProduct[]>(
          `/admin/products${query ? `?q=${encodeURIComponent(query)}` : ''}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    // Brand/category lists come from public read endpoints.
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/v1/brands`)
      .then((r) => r.json())
      .then(setBrands)
      .catch(() => undefined);
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/v1/categories`)
      .then((r) => r.json())
      .then((tree: Category[]) => setCategories(flatten(tree)))
      .catch(() => undefined);
  }, [load]);

  async function remove(id: string) {
    if (!confirm('Soft-delete this product?')) return;
    try {
      await authFetch(`/admin/products/${id}`, { method: 'DELETE' });
      await load(q);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Products</h1>
        {can('product.create') && (
          <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Close' : '+ New product'}
          </button>
        )}
      </div>

      {showForm && (
        <ProductForm
          brands={brands}
          categories={categories}
          onSaved={() => {
            setShowForm(false);
            void load(q);
          }}
        />
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load(q);
        }}
      >
        <input
          className="input max-w-xs"
          placeholder="Search products…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn-ghost">Search</button>
      </form>

      {error && <p className="mt-4 text-sm text-[hsl(var(--danger))]">{error}</p>}

      <div className="card mt-4 overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="th">Name</th>
              <th className="th">Brand</th>
              <th className="th">Category</th>
              <th className="th">Status</th>
              <th className="th">Best $</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td className="td font-medium">
                  {p.name}
                  <div className="text-xs text-muted-foreground">{p.slug}</div>
                </td>
                <td className="td">{p.brand?.name}</td>
                <td className="td">{p.category?.name}</td>
                <td className="td">
                  <StatusBadge status={p.status} />
                </td>
                <td className="td">{p.minPriceUsd ? `$${Number(p.minPriceUsd)}` : '—'}</td>
                <td className="td text-right">
                  {can('product.delete') && (
                    <button className="btn-danger !px-2 !py-1 text-xs" onClick={() => void remove(p.id)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td className="td text-muted-foreground" colSpan={6}>
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'published'
      ? 'bg-success/15 text-success'
      : status === 'draft'
        ? 'bg-muted text-muted-foreground'
        : 'bg-accent/15 text-accent';
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold capitalize ${tone}`}>{status}</span>
  );
}

function ProductForm({
  brands,
  categories,
  onSaved,
}: {
  brands: Brand[];
  categories: Category[];
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await authFetch('/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          slug: fd.get('slug'),
          brandId: fd.get('brandId'),
          categoryId: fd.get('categoryId'),
          status: fd.get('status'),
          shortDesc: fd.get('shortDesc') || undefined,
        }),
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mt-4 grid gap-4 p-5 sm:grid-cols-2">
      <div>
        <label className="label">Name</label>
        <input name="name" required className="input" />
      </div>
      <div>
        <label className="label">Slug</label>
        <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="input" />
      </div>
      <div>
        <label className="label">Brand</label>
        <select name="brandId" required className="input">
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Category</label>
        <select name="categoryId" required className="input">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Status</label>
        <select name="status" className="input" defaultValue="draft">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>
      <div>
        <label className="label">Short description</label>
        <input name="shortDesc" className="input" />
      </div>
      {error && <p className="text-sm text-[hsl(var(--danger))] sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : 'Create product'}
        </button>
      </div>
    </form>
  );
}

function flatten(tree: Category[], acc: Category[] = []): Category[] {
  for (const node of tree) {
    acc.push({ id: node.id, name: node.name });
    if (node.children?.length) flatten(node.children, acc);
  }
  return acc;
}
