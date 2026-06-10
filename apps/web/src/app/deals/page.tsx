import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { ProductCard } from '@/components/product-card';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Top Deals — Lowest Gadget Prices Today',
  description: 'The best gadget prices right now, compared across stores.',
  alternates: { canonical: '/deals' },
};

export default async function DealsPage() {
  // Lowest-priced in-stock products. True "deal score" (drop vs list/median
  // price) lands with the deals/analytics job; this keeps the page honest.
  const result = await api.listProducts('?sort=price_usd&limit=24');

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold">🏷️ Top Deals</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Best prices across stores right now.
      </p>

      <div className="mt-8">
        {result.data.length === 0 ? (
          <p className="rounded-xl border p-8 text-center text-muted-foreground">
            No deals available yet — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {result.data.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
