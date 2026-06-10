import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { usd, rating } from '@/lib/format';
import { PriceTable } from '@/components/price-table';
import { SpecTable } from '@/components/spec-table';
import { PriceHistoryChart } from '@/components/price-history-chart';
import { productJsonLd, breadcrumbJsonLd } from '@/lib/jsonld';

export const revalidate = 300; // ISR; on-demand revalidation on price change

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await api.getProduct(params.slug);
  if (!product) return { title: 'Product not found' };
  const year = product.releaseDate ? new Date(product.releaseDate).getFullYear() : '';
  const price = product.minPriceUsd ? ` from ${usd(product.minPriceUsd)}` : '';
  return {
    title: `${product.name} Price & Specs ${year}`,
    description:
      product.shortDesc ??
      `${product.name}${price}. Compare prices across stores, full specifications, reviews and price history.`,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title: `${product.name} — Price & Specs`, type: 'website' },
  };
}

export default async function ProductPage({ params }: Props) {
  const [product, prices, history] = await Promise.all([
    api.getProduct(params.slug),
    api.getPrices(params.slug),
    api.getPriceHistory(params.slug),
  ]);

  if (!product) notFound();

  const best = prices.bestPrice;

  return (
    <div className="container-page py-6">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(product, prices)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(product)) }}
      />

      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-4">
        <Link href="/" className="hover:text-foreground">Home</Link>
        {' › '}
        <Link href={`/category/${product.category.slug}`} className="hover:text-foreground">
          {product.category.name}
        </Link>
        {' › '}
        <span className="text-foreground">{product.name}</span>
      </nav>

      {/* Hero */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="aspect-square rounded-2xl bg-muted flex items-center justify-center text-7xl">
          📱
        </div>
        <div>
          <div className="text-sm text-muted-foreground">{product.brand.name}</div>
          <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <span className="text-amber-500">★ {rating(product.ratingAvg)}</span>
            <span className="text-muted-foreground">({product.ratingCount} reviews)</span>
            {product.releaseDate && (
              <span className="text-muted-foreground">
                · {new Date(product.releaseDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>

          {best && (
            <div className="mt-6 rounded-xl border p-4">
              <div className="text-sm text-muted-foreground">Best price</div>
              <div className="text-3xl font-bold">{usd(best.priceUsd)}</div>
              <div className="text-sm text-muted-foreground">at {best.store.name}</div>
              <a
                href={best.affiliateLink?.shortCode ? `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/go/${best.affiliateLink.shortCode}` : best.productUrl ?? '#'}
                rel="nofollow sponsored noopener"
                target="_blank"
                className="mt-3 inline-flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:opacity-90"
              >
                Buy at {best.store.name} →
              </a>
              <Link
                href={`/compare?p=${product.slug}`}
                className="mt-2 inline-flex w-full justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
              >
                ⚖️ Compare with another gadget
              </Link>
            </div>
          )}

          {product.keyFeatures?.length > 0 && (
            <ul className="mt-6 grid grid-cols-2 gap-2 text-sm">
              {product.keyFeatures.map((f) => (
                <li key={f} className="rounded-lg bg-muted px-3 py-2">⚡ {f}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Price comparison */}
      <Section title="💲 Price Comparison">
        <PriceTable offers={prices.offers} />
      </Section>

      {/* Price history */}
      <Section title="📈 Price History">
        <PriceHistoryChart history={history} />
      </Section>

      {/* Specs */}
      <Section title="📋 Specifications">
        <SpecTable product={product} />
      </Section>

      {/* Pros / Cons */}
      {(product.pros?.length > 0 || product.cons?.length > 0) && (
        <Section title="✅ Pros &amp; Cons">
          <div className="grid sm:grid-cols-2 gap-4">
            <ProsCons title="Pros" items={product.pros} tone="success" />
            <ProsCons title="Cons" items={product.cons} tone="accent" />
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold mb-4" dangerouslySetInnerHTML={{ __html: title }} />
      {children}
    </section>
  );
}

function ProsCons({ title, items, tone }: { title: string; items: string[]; tone: 'success' | 'accent' }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-xl border p-4">
      <h3 className="font-semibold mb-2">{title}</h3>
      <ul className="space-y-1.5 text-sm">
        {items.map((it) => (
          <li key={it} className="flex gap-2">
            <span className={tone === 'success' ? 'text-success' : 'text-accent'}>
              {tone === 'success' ? '✓' : '✕'}
            </span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
