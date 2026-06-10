'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Suggestions {
  products: { name: string; slug: string }[];
  brands: { name: string; slug: string }[];
  categories: { name: string; slug: string }[];
}

const EMPTY: Suggestions = { products: [], brands: [], categories: [] };

export function SearchBox({ initialQuery = '' }: { initialQuery?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions>(EMPTY);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (q.trim().length < 2) {
      setSuggestions(EMPTY);
      return;
    }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_URL}/v1/search/autocomplete?q=${encodeURIComponent(q.trim())}`,
        );
        if (res.ok) {
          setSuggestions({ ...EMPTY, ...(await res.json()) });
          setOpen(true);
        }
      } catch {
        setSuggestions(EMPTY);
      }
    }, 150);
    return () => clearTimeout(debounce.current);
  }, [q]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  const hasSuggestions =
    suggestions.products.length + suggestions.brands.length + suggestions.categories.length > 0;

  return (
    <div className="relative">
      <form onSubmit={submit} role="search">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hasSuggestions && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search phones, laptops, brands…"
          aria-label="Search products"
          className="w-full rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />
      </form>

      {open && hasSuggestions && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border bg-card p-2 shadow-xl text-sm">
          <SuggestionGroup
            title="Products"
            items={suggestions.products.map((p) => ({ label: p.name, href: `/products/${p.slug}` }))}
          />
          <SuggestionGroup
            title="Brands"
            items={suggestions.brands.map((b) => ({ label: b.name, href: `/brands/${b.slug}` }))}
          />
          <SuggestionGroup
            title="Categories"
            items={suggestions.categories.map((c) => ({
              label: c.name,
              href: `/category/${c.slug}`,
            }))}
          />
        </div>
      )}
    </div>
  );
}

function SuggestionGroup({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="py-1">
      <div className="px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">{title}</div>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="block rounded-lg px-3 py-2 hover:bg-muted"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
