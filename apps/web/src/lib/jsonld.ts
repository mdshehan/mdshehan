import type { ProductDetail, PriceComparison } from './types';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gadgethub.com';

/** Server-built Product + AggregateOffer + AggregateRating JSON-LD. */
export function productJsonLd(product: ProductDetail, prices: PriceComparison) {
  const offers = prices.offers ?? [];
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDesc ?? product.description ?? undefined,
    brand: { '@type': 'Brand', name: product.brand.name },
    category: product.category.name,
    releaseDate: product.releaseDate ?? undefined,
  };

  if (Number(product.ratingCount) > 0) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(product.ratingAvg).toFixed(1),
      bestRating: '5',
      ratingCount: product.ratingCount,
    };
  }

  if (offers.length > 0) {
    const usdValues = offers.map((o) => Number(o.priceUsd));
    node.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: Math.min(...usdValues).toFixed(2),
      highPrice: Math.max(...usdValues).toFixed(2),
      offerCount: offers.length,
      offers: offers.map((o) => ({
        '@type': 'Offer',
        price: Number(o.priceUsd).toFixed(2),
        priceCurrency: 'USD',
        availability:
          o.availability === 'in_stock'
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: o.store.name },
      })),
    };
  }

  return node;
}

export function breadcrumbJsonLd(product: ProductDetail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: product.category.name,
        item: `${SITE_URL}/category/${product.category.slug}`,
      },
      { '@type': 'ListItem', position: 3, name: product.name },
    ],
  };
}
