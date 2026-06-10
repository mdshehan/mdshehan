import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { hitToProduct } from '@/lib/normalize';
import { ProductCard } from '@/components/product-card';
import { FilterSidebar } from '@/components/filter-sidebar';
import { SearchBox } from '@/components/search-box';

// Search results are user-specific noise for crawlers — render fresh, keep noindex.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Search',
  robots: { index: false, follow: true },
};

interface Props {
  searchParams: Record<string, string | undefined>;
}

export default async function SearchPage({ searchParams }: Props) {
  const q = searchParams.q?.trim() ?? '';

  const query = new URLSearchParams({ limit: '24' });
  if (q) query.set('q', q);
  for (const key of ['brand', 'category', 'price_min', 'price_max', 'ram', 'storage', 'sort']) {
    const value = searchParams[key];
    if (value) query.set(key, value);
  }

  const result = q || query.size > 1 ? await api.search(query) : null;
  const products = result?.hits.map(hitToProduct) ?? [];

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">Search</h1>
        <SearchBox initialQuery={q} />
      </div>

      {result && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside>
            <FilterSidebar
              action="/search"
              current={searchParams}
              facets={result.facets}
              showCategoryFilter
            />
          </aside>
          <div>
            <p className="mb-4 text-sm text-muted-foreground">
              {result.total} result{result.total === 1 ? '' : 's'}
              {q ? ` for “${q}”` : ''}
            </p>
            {products.length === 0 ? (
              <p className="rounded-xl border p-8 text-center text-muted-foreground">
                Nothing found. Try a different spelling or fewer filters.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((p) => (
                  <ProductCard key={p.id || p.slug} product={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
