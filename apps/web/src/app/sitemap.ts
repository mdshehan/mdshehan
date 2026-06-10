import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gadgethub.com';

export const revalidate = 3600;

/**
 * Single sitemap for now; the workers step shards this into
 * products-{n}.xml files (50k URLs each) generated to S3 per doc 08.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, brands] = await Promise.all([
    api.listProducts('?limit=100&sort=-release_date'),
    api.listBrands(),
  ]);

  const productEntries: MetadataRoute.Sitemap = products.data.map((p) => ({
    url: `${SITE_URL}/products/${p.slug}`,
    lastModified: (p as { updatedAt?: string }).updatedAt ?? new Date(),
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const brandEntries: MetadataRoute.Sitemap = brands.map((b) => ({
    url: `${SITE_URL}/brands/${b.slug}`,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [
    { url: `${SITE_URL}/`, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/deals`, changeFrequency: 'hourly', priority: 0.9 },
    ...productEntries,
    ...brandEntries,
  ];
}
