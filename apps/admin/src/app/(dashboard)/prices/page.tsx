'use client';

import { useEffect, useState } from 'react';
import { authFetch, API_URL } from '@/lib/api';

interface Option {
  id: string;
  name: string;
}
interface Currency {
  id: string;
  code: string;
}

export default function PricesPage() {
  const [products, setProducts] = useState<Option[]>([]);
  const [stores, setStores] = useState<Option[]>([]);
  const [countries, setCountries] = useState<Option[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authFetch<Option[]>('/admin/products?limit=200').then(setProducts).catch(() => undefined);
    authFetch<Option[]>('/admin/stores').then(setStores).catch(() => undefined);
    fetch(`${API_URL}/v1/countries`)
      .then((r) => r.json())
      .then(setCountries)
      .catch(() => undefined);
    fetch(`${API_URL}/v1/currencies`)
      .then((r) => r.json())
      .then(setCurrencies)
      .catch(() => undefined);
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await authFetch('/admin/prices', {
        method: 'POST',
        body: JSON.stringify({
          productId: fd.get('productId'),
          storeId: fd.get('storeId'),
          countryId: fd.get('countryId'),
          currencyId: fd.get('currencyId'),
          price: Number(fd.get('price')),
          listPrice: fd.get('listPrice') ? Number(fd.get('listPrice')) : undefined,
          productUrl: fd.get('productUrl') || undefined,
          availability: fd.get('availability'),
        }),
      });
      setMessage({ tone: 'ok', text: 'Offer saved — history recorded, best price recomputed.' });
      form.reset();
    } catch (err) {
      setMessage({ tone: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Prices</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Upsert a store offer. Each save appends price history and refreshes the product&apos;s best
        price + search index.
      </p>

      <form onSubmit={submit} className="card mt-4 grid max-w-3xl gap-4 p-5 sm:grid-cols-2">
        <Select label="Product" name="productId" options={products.map((p) => [p.id, p.name])} />
        <Select label="Store" name="storeId" options={stores.map((s) => [s.id, s.name])} />
        <Select label="Country" name="countryId" options={countries.map((c) => [c.id, c.name])} />
        <Select
          label="Currency"
          name="currencyId"
          options={currencies.map((c) => [c.id, c.code])}
        />
        <div>
          <label className="label">Price</label>
          <input name="price" type="number" step="0.01" min="0" required className="input" />
        </div>
        <div>
          <label className="label">List price (optional)</label>
          <input name="listPrice" type="number" step="0.01" min="0" className="input" />
        </div>
        <div>
          <label className="label">Availability</label>
          <select name="availability" className="input" defaultValue="in_stock">
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="preorder">Preorder</option>
          </select>
        </div>
        <div>
          <label className="label">Merchant URL (optional)</label>
          <input name="productUrl" type="url" className="input" />
        </div>
        {message && (
          <p
            className={`text-sm sm:col-span-2 ${
              message.tone === 'ok' ? 'text-success' : 'text-[hsl(var(--danger))]'
            }`}
          >
            {message.text}
          </p>
        )}
        <div className="sm:col-span-2">
          <button disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Save offer'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Select({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: [string, string][];
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select name={name} required className="input">
        {options.length === 0 && <option value="">—</option>}
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
