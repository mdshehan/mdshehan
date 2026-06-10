// Shapes returned by the @ggph/api (subset used by the storefront).
// In production these are imported from a shared @ggph/types package.

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  children?: Category[];
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  ratingAvg: string | number;
  minPriceUsd: string | number | null;
  availability: string;
  brand?: Brand;
  category?: Category;
}

export interface ProductDetail extends ProductListItem {
  description?: string | null;
  shortDesc?: string | null;
  specs: Record<string, unknown>;
  pros: string[];
  cons: string[];
  keyFeatures: string[];
  releaseDate?: string | null;
  ratingCount: number;
  brand: Brand;
  category: Category;
  variants: { id: string; name: string; attributes: Record<string, unknown> }[];
  specifications: { attribute: { key: string; label: string; unit?: string | null }; valueString?: string | null; valueNumber?: string | null }[];
  reviews: { id: string; title?: string | null; body?: string | null; rating: string | number; authorName?: string | null }[];
}

export interface Offer {
  id: string;
  price: string | number;
  priceUsd: string | number;
  availability: string;
  productUrl?: string | null;
  store: { id: string; name: string; slug: string };
  currency: { code: string; symbol: string };
  affiliateLink?: { shortCode?: string | null } | null;
}

export interface PriceComparison {
  country: string;
  bestPrice: Offer | null;
  offers: Offer[];
}

export interface PricePoint {
  storeId: string;
  priceUsd: string | number;
  recordedAt: string;
}

export interface PriceHistory {
  days: number;
  lowestUsd: number | null;
  points: PricePoint[];
}

export interface Paged<T> {
  data: T[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
}
