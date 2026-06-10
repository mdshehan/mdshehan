import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import { usd, rating } from '@/lib/format';
import type { ProductDetail, PriceComparison } from '@/lib/types';

export const revalidate = 900;

interface Props {
  searchParams: { p?: string };
}

export function generateMetadata({ searchParams }: Props): Metadata {
  const slugs = parseSlugs(searchParams.p);
  if (slugs.length < 2) return { title: 'Compare Products' };
  const names = slugs.map((s) => s.replace(/-/g, ' ')).join(' vs ');
  return {
    title: `${names} — Comparison`,
    description: `Side-by-side comparison: specs, prices, ratings, pros and cons.`,
  };
}

function parseSlugs(p?: string): string[] {
  return (p ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
}

export default async function ComparePage({ searchParams }: Props) {
  const slugs = parseSlugs(searchParams.p);

  const loaded = await Promise.all(
    slugs.map(async (slug) => ({
      product: await api.getProduct(slug),
      prices: await api.getPrices(slug),
    })),
  );
  const items = loaded.filter(
    (x): x is { product: ProductDetail; prices: PriceComparison } => x.product !== null,
  );

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold">Compare Products</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Compare 2–4 gadgets side by side — specs, prices, ratings, pros &amp; cons.
      </p>

      {/* Slug entry form (works without JS) */}
      <form method="get" action="/compare" className="mt-4 flex flex-wrap gap-2 text-sm">
        <input
          type="text"
          name="p"
          defaultValue={slugs.join(',')}
          placeholder="slug-one,slug-two[,slug-three,slug-four]"
          className="w-full max-w-xl rounded-lg border bg-background px-3 py-2"
        />
        <button className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90">
          Compare
        </button>
      </form>

      {items.length < 2 ? (
        <p className="mt-10 rounded-xl border p-8 text-center text-muted-foreground">
          Add at least two product slugs to compare — e.g.{' '}
          <Link
            href="/compare?p=samsung-galaxy-s25-ultra,apple-iphone-16-pro"
            className="text-primary underline"
          >
            Galaxy S25 Ultra vs iPhone 16 Pro
          </Link>
        </p>
      ) : (
        <ComparisonTable items={items} />
      )}
    </div>
  );
}

function ComparisonTable({
  items,
}: {
  items: { product: ProductDetail; prices: PriceComparison }[];
}) {
  // Spec matrix: union of attribute labels across products, in first-seen order.
  const labels: string[] = [];
  const valueMap = items.map(({ product }) => {
    const map = new Map<string, string>();
    for (const s of product.specifications ?? []) {
      const label = s.attribute.label;
      const value = `${s.valueString ?? s.valueNumber ?? ''}${s.attribute.unit ? ` ${s.attribute.unit}` : ''}`;
      map.set(label, value);
      if (!labels.includes(label)) labels.push(label);
    }
    // JSONB fallback when normalized rows are absent
    if (map.size === 0) {
      for (const [k, v] of Object.entries(product.specs ?? {})) {
        const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        map.set(label, String(v));
        if (!labels.includes(label)) labels.push(label);
      }
    }
    return map;
  });

  return (
    <div className="mt-8 overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm border-separate border-spacing-0">
        <thead>
          <tr>
            <Th sticky />
            {items.map(({ product }) => (
              <Th key={product.id}>
                <Link href={`/products/${product.slug}`} className="hover:text-primary">
                  <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-lg bg-muted text-3xl">
                    📱
                  </div>
                  <div className="font-semibold leading-snug">{product.name}</div>
                  <div className="text-xs text-muted-foreground">{product.brand.name}</div>
                </Link>
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row label="Best Price" values={items.map(({ prices }) => usd(prices.bestPrice?.priceUsd ?? null))} highlight />
          <Row label="Rating" values={items.map(({ product }) => `★ ${rating(product.ratingAvg)}`)} highlight />
          {labels.map((label) => (
            <Row key={label} label={label} values={valueMap.map((m) => m.get(label) ?? '—')} highlight />
          ))}
          <ListRow label="Pros" tone="success" lists={items.map(({ product }) => product.pros ?? [])} />
          <ListRow label="Cons" tone="accent" lists={items.map(({ product }) => product.cons ?? [])} />
          <tr>
            <Td sticky />
            {items.map(({ product, prices }) => (
              <Td key={product.id} center>
                {prices.bestPrice ? (
                  <a
                    href={
                      prices.bestPrice.affiliateLink?.shortCode
                        ? `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/go/${prices.bestPrice.affiliateLink.shortCode}`
                        : prices.bestPrice.productUrl ?? '#'
                    }
                    rel="nofollow sponsored noopener"
                    target="_blank"
                    className="inline-flex rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Buy {usd(prices.bestPrice.priceUsd)} →
                  </a>
                ) : (
                  <span className="text-muted-foreground">No offers</span>
                )}
              </Td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, sticky }: { children?: React.ReactNode; sticky?: boolean }) {
  return (
    <th
      className={`border-b p-3 text-center align-bottom ${
        sticky ? 'sticky left-0 bg-background z-10 w-36' : ''
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, sticky, center }: { children?: React.ReactNode; sticky?: boolean; center?: boolean }) {
  return (
    <td
      className={`border-b p-3 ${center ? 'text-center' : ''} ${
        sticky ? 'sticky left-0 bg-background z-10 font-medium text-muted-foreground' : ''
      }`}
    >
      {children}
    </td>
  );
}

function Row({ label, values, highlight }: { label: string; values: string[]; highlight?: boolean }) {
  const allSame = highlight && values.every((v) => v === values[0]);
  return (
    <tr className={highlight && !allSame ? 'bg-primary/5' : ''}>
      <Td sticky>{label}</Td>
      {values.map((v, i) => (
        <Td key={i} center>
          {v}
        </Td>
      ))}
    </tr>
  );
}

function ListRow({ label, lists, tone }: { label: string; lists: string[][]; tone: 'success' | 'accent' }) {
  if (lists.every((l) => l.length === 0)) return null;
  return (
    <tr>
      <Td sticky>{label}</Td>
      {lists.map((list, i) => (
        <Td key={i}>
          <ul className="space-y-1">
            {list.map((item) => (
              <li key={item} className="flex gap-1.5">
                <span className={tone === 'success' ? 'text-success' : 'text-accent'}>
                  {tone === 'success' ? '✓' : '✕'}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Td>
      ))}
    </tr>
  );
}
