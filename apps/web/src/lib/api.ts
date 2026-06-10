import type {
  Paged,
  ProductListItem,
  ProductDetail,
  PriceComparison,
  PriceHistory,
  Brand,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** ISR window (seconds). Product/price pages revalidate frequently; lists less so. */
const REVALIDATE = { product: 300, list: 900, config: 3600 };

/**
 * Resilient fetch: returns `fallback` on any network/HTTP error so pages render
 * (and the build succeeds) even when the API is unavailable. Real errors are
 * surfaced via the null/fallback so callers can render empty states or 404.
 */
async function getJson<T>(path: string, revalidate: number, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}/v1${path}`, { next: { revalidate } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export const api = {
  listProducts: (query = '') =>
    getJson<Paged<ProductListItem>>(`/products${query}`, REVALIDATE.list, {
      data: [],
      pageInfo: { endCursor: null, hasNextPage: false },
    }),

  getProduct: (slug: string) =>
    getJson<ProductDetail | null>(`/products/${slug}`, REVALIDATE.product, null),

  getPrices: (slug: string, country = 'US') =>
    getJson<PriceComparison>(`/products/${slug}/prices?country=${country}`, REVALIDATE.product, {
      country,
      bestPrice: null,
      offers: [],
    }),

  getPriceHistory: (slug: string, days = 180) =>
    getJson<PriceHistory>(`/products/${slug}/price-history?days=${days}`, REVALIDATE.product, {
      days,
      lowestUsd: null,
      points: [],
    }),

  listBrands: () => getJson<Brand[]>(`/brands`, REVALIDATE.list, []),
};

export { API_URL };
