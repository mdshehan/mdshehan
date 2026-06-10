import type { SearchHit, ProductListItem } from './types';

/** Normalize a search hit (Meili doc or PG row) into the ProductCard shape. */
export function hitToProduct(hit: SearchHit): ProductListItem {
  return {
    id: hit.id,
    name: hit.name,
    slug: hit.slug,
    ratingAvg: hit.ratingAvg ?? 0,
    minPriceUsd: hit.minPriceUsd ?? hit.priceUsd ?? null,
    availability: 'in_stock',
    brand: hit.brand ?? (hit.brandName ? { id: '', name: hit.brandName, slug: '' } : undefined),
  };
}
