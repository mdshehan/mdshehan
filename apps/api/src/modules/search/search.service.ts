import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MeiliService } from './meili.service';

export interface SearchParams {
  q?: string;
  brand?: string;
  category?: string;
  priceMin?: number;
  priceMax?: number;
  ram?: number;
  storage?: number;
  sort?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly meili: MeiliService,
    private readonly prisma: PrismaService,
  ) {}

  async search(params: SearchParams) {
    const limit = Math.min(params.limit ?? 24, 100);
    if (this.meili.isAvailable) {
      return this.searchMeili(params, limit);
    }
    return this.searchPostgres(params, limit);
  }

  async autocomplete(q: string) {
    if (!q || q.length < 2) return { products: [], brands: [], categories: [] };

    if (this.meili.isAvailable) {
      const res = await this.meili.index().search(q, {
        limit: 6,
        attributesToRetrieve: ['name', 'slug', 'brandName', 'priceUsd'],
      });
      return {
        products: res.hits,
        // brand/category suggestions from a light DB lookup
        ...(await this.entitySuggestions(q)),
      };
    }
    const products = await this.prisma.product.findMany({
      where: { name: { contains: q, mode: 'insensitive' }, status: 'published', deletedAt: null },
      take: 6,
      select: { name: true, slug: true },
    });
    return { products, ...(await this.entitySuggestions(q)) };
  }

  private async searchMeili(params: SearchParams, limit: number) {
    const filters: string[] = [];
    if (params.brand) filters.push(`brandSlug = "${params.brand}"`);
    if (params.category) filters.push(`categorySlug = "${params.category}"`);
    if (params.ram) filters.push(`ram = ${params.ram}`);
    if (params.storage) filters.push(`storage = ${params.storage}`);
    if (params.priceMin !== undefined) filters.push(`priceUsd >= ${params.priceMin}`);
    if (params.priceMax !== undefined) filters.push(`priceUsd <= ${params.priceMax}`);

    const res = await this.meili.index().search(params.q ?? '', {
      limit,
      offset: params.offset ?? 0,
      filter: filters.length ? filters.join(' AND ') : undefined,
      sort: this.meiliSort(params.sort),
      facets: ['brandSlug', 'categorySlug', 'ram', 'storage', 'availability'],
    });

    return {
      engine: 'meilisearch',
      total: res.estimatedTotalHits,
      hits: res.hits,
      facets: res.facetDistribution ?? {},
    };
  }

  private meiliSort(sort?: string): string[] | undefined {
    switch (sort) {
      case 'price':
        return ['priceUsd:asc'];
      case '-price':
        return ['priceUsd:desc'];
      case 'rating':
        return ['ratingAvg:desc'];
      case 'release':
        return ['releaseTs:desc'];
      default:
        return undefined; // relevance
    }
  }

  /** Postgres fallback when the search engine is unavailable (graceful degradation). */
  private async searchPostgres(params: SearchParams, limit: number) {
    const rows = await this.prisma.product.findMany({
      where: {
        status: 'published',
        deletedAt: null,
        ...(params.q ? { name: { contains: params.q, mode: 'insensitive' } } : {}),
        ...(params.brand ? { brand: { slug: params.brand } } : {}),
        ...(params.category ? { category: { slug: params.category } } : {}),
        ...(params.priceMin || params.priceMax
          ? {
              minPriceUsd: {
                ...(params.priceMin ? { gte: params.priceMin } : {}),
                ...(params.priceMax ? { lte: params.priceMax } : {}),
              },
            }
          : {}),
      },
      take: limit,
      skip: params.offset ?? 0,
      orderBy: [{ isFeatured: 'desc' }, { ratingAvg: 'desc' }],
      include: { brand: true, category: true },
    });
    return { engine: 'postgres', total: rows.length, hits: rows, facets: {} };
  }

  private async entitySuggestions(q: string) {
    const [brands, categories] = await Promise.all([
      this.prisma.brand.findMany({
        where: { name: { contains: q, mode: 'insensitive' }, isActive: true },
        take: 3,
        select: { name: true, slug: true },
      }),
      this.prisma.category.findMany({
        where: { name: { contains: q, mode: 'insensitive' }, isActive: true },
        take: 3,
        select: { name: true, slug: true },
      }),
    ]);
    return { brands, categories };
  }
}
