import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ListProductsParams {
  brand?: string;
  category?: string;
  q?: string;
  priceMin?: number;
  priceMax?: number;
  sort?: string;
  limit?: number;
  cursor?: string;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: ListProductsParams) {
    const limit = Math.min(params.limit ?? 24, 100);
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      status: 'published',
      ...(params.brand ? { brand: { slug: params.brand } } : {}),
      ...(params.category ? { category: { slug: params.category } } : {}),
      ...(params.q ? { name: { contains: params.q, mode: 'insensitive' } } : {}),
      ...(params.priceMin || params.priceMax
        ? {
            minPriceUsd: {
              ...(params.priceMin ? { gte: params.priceMin } : {}),
              ...(params.priceMax ? { lte: params.priceMax } : {}),
            },
          }
        : {}),
    };

    const orderBy = this.parseSort(params.sort);

    const rows = await this.prisma.product.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: { brand: true, category: true },
    });

    const hasNext = rows.length > limit;
    const data = rows.slice(0, limit);
    return {
      data,
      pageInfo: {
        endCursor: data.length ? data[data.length - 1].id : null,
        hasNextPage: hasNext,
      },
    };
  }

  async getBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null },
      include: {
        brand: true,
        category: true,
        variants: true,
        specifications: { include: { attribute: true } },
        reviews: { where: { status: 'approved' }, take: 10, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!product) throw new NotFoundException(`Product '${slug}' not found`);
    return product;
  }

  async getPrices(slug: string, countryIso = 'US') {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException(`Product '${slug}' not found`);

    const offers = await this.prisma.price.findMany({
      where: { productId: product.id, country: { iso2: countryIso } },
      orderBy: { priceUsd: 'asc' },
      include: { store: true, currency: true, affiliateLink: true },
    });
    return {
      country: countryIso,
      bestPrice: offers[0] ?? null,
      offers,
    };
  }

  private parseSort(sort?: string): Prisma.ProductOrderByWithRelationInput[] {
    if (!sort) return [{ isFeatured: 'desc' }, { ratingAvg: 'desc' }];
    return sort.split(',').map((token) => {
      const desc = token.startsWith('-');
      const field = desc ? token.slice(1) : token;
      const dir: Prisma.SortOrder = desc ? 'desc' : 'asc';
      switch (field) {
        case 'price':
        case 'price_usd':
          return { minPriceUsd: dir };
        case 'release_date':
          return { releaseDate: dir };
        case 'rating':
          return { ratingAvg: dir };
        default:
          return { createdAt: dir };
      }
    });
  }
}
