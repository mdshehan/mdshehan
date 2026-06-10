import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { hitToProduct } from '@/lib/normalize';
import { ProductCard } from '@/components/product-card';
import { FilterSidebar } from '@/components/filter-sidebar';

export const revalidate = 900;

interface Props {
  params: { slug: string };
  searchParams: Record<string, string | undefined>;
}

function titleFromSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function generateMetadata({ params }: Props): Metadata {
  const name = titleFromSlug(params.slug);
  return {
    title: `${name} — Compare Prices & Specs`,
    description: `Browse ${name.toLowerCase()} and compare prices across stores. Filter by brand, price, RAM and storage.`,
    alternates: { canonical: `/category/${params.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const query = new URLSearchParams({ category: params.slug, limit: '24' });
  for (const key of ['q', 'brand', 'price_min', 'price_max', 'ram', 'storage', 'sort']) {
    const value = searchParams[key];
    if (value) query.set(key, value);
  }

  const result = await api.search(query);
  const products = result.hits.map(hitToProduct);
  const name = titleFromSlug(params.slug);

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold">
        {name} <span className="text-base font-normal text-muted-foreground">({result.total})</span>
      </h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside>
          <FilterSidebar
            action={`/category/${params.slug}`}
            current={searchParams}
            facets={result.facets}
          />
        </aside>

        <div>
          {products.length === 0 ? (
            <p className="rounded-xl border p-8 text-center text-muted-foreground">
              No products match these filters yet.
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
    </div>
  );
}
