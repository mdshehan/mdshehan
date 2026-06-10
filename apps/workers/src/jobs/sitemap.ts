import { Job } from 'bullmq';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '../prisma';
import type { SitemapJob } from '../queues';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gadgethub.com';
// Local dir for dev; production uploads these to S3 and serves via CDN (doc 08).
const OUT_DIR = process.env.SITEMAP_OUT_DIR ?? join(process.cwd(), 'generated-sitemaps');

function urlEntry(loc: string, lastmod?: Date, priority = 0.8): string {
  const mod = lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : '';
  return `  <url><loc>${loc}</loc>${mod}<priority>${priority}</priority></url>`;
}

function wrapUrlset(entries: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

/**
 * Generate sharded product sitemaps (50k URLs each) + a sitemap index.
 * Keyset-paginates products so it scales to millions of rows.
 */
export async function processSitemap(job: Job<SitemapJob>) {
  const shardSize = job.data?.shardSize ?? 50_000;
  await mkdir(OUT_DIR, { recursive: true });

  const shardFiles: string[] = [];
  let cursor: string | undefined;
  let shardIndex = 0;

  for (;;) {
    const products = await prisma.product.findMany({
      where: { status: 'published', deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { id: 'asc' },
      take: shardSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (products.length === 0) break;

    const entries = products.map((p) => urlEntry(`${SITE_URL}/products/${p.slug}`, p.updatedAt));
    const filename = `products-${shardIndex}.xml`;
    await writeFile(join(OUT_DIR, filename), wrapUrlset(entries), 'utf8');
    shardFiles.push(filename);

    // Keyset pagination needs the last id; fetch it once more cheaply.
    const last = await prisma.product.findFirst({
      where: { slug: products[products.length - 1].slug },
      select: { id: true },
    });
    cursor = last?.id;
    shardIndex++;
    if (products.length < shardSize) break;
  }

  // Sitemap index
  const indexEntries = shardFiles
    .map((f) => `  <sitemap><loc>${SITE_URL}/sitemaps/${f}</loc></sitemap>`)
    .join('\n');
  const indexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexEntries}\n</sitemapindex>\n`;
  await writeFile(join(OUT_DIR, 'sitemap-index.xml'), indexXml, 'utf8');

  return { shards: shardFiles.length, outDir: OUT_DIR };
}
