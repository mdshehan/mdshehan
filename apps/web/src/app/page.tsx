import Link from 'next/link';
import { api } from '@/lib/api';
import { ProductCard } from '@/components/product-card';

export const revalidate = 900;

export default async function HomePage() {
  const [trending, latest, brands] = await Promise.all([
    api.listProducts('?sort=rating&limit=8'),
    api.listProducts('?sort=-release_date&limit=8'),
    api.listBrands(),
  ]);

  return (
    <div className="container-page py-8 space-y-12">
      {/* Hero */}
      <section className="rounded-2xl border bg-gradient-to-br from-primary/10 to-accent/10 p-8 sm:p-12">
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight max-w-3xl">
          Compare gadget prices &amp; specs across the world.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
          Smartphones, laptops, tablets, TVs and more — find the best price from every store, with
          full specs, reviews and price history.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/search"
            className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90"
          >
            Start comparing
          </Link>
          <Link href="/deals" className="rounded-lg border px-5 py-2.5 font-semibold hover:bg-muted">
            Today&apos;s deals
          </Link>
        </div>
      </section>

      <Section title="🔥 Trending Products" products={trending.data} />
      <Section title="🆕 Latest Launches" products={latest.data} />

      {brands.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">Popular Brands</h2>
          <div className="flex flex-wrap gap-2">
            {brands.map((b) => (
              <Link
                key={b.id}
                href={`/brands/${b.slug}`}
                className="rounded-full border px-4 py-2 text-sm hover:bg-muted"
              >
                {b.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Section({
  title,
  products,
}: {
  title: string;
  products: { id: string; slug: string; name: string; ratingAvg: string | number; minPriceUsd: string | number | null; availability: string }[];
}) {
  if (products.length === 0) {
    return (
      <section>
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="text-sm text-muted-foreground">
          No products yet — run <code className="rounded bg-muted px-1">pnpm db:seed</code> and start the API.
        </p>
      </section>
    );
  }
  return (
    <section>
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
