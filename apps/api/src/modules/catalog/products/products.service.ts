import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './products.dto';
import { CatalogEvents } from '../../../common/events/catalog.events';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

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

  /** Admin listing: includes drafts/archived (everything not soft-deleted). */
  listAdmin(q?: string, limit = 50) {
    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      take: Math.min(limit, 200),
      orderBy: { updatedAt: 'desc' },
      include: { brand: true, category: true },
    });
  }

  async create(dto: CreateProductDto) {
    const exists = await this.prisma.product.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException(`Slug '${dto.slug}' already in use`);
    const product = await this.prisma.product.create({
      data: {
        ...dto,
        specs: dto.specs as Prisma.InputJsonValue,
        publishedAt: dto.status === 'published' ? new Date() : null,
      },
    });
    this.events.emit(CatalogEvents.ProductChanged, { productId: product.id });
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.ensureExists(id);
    const { specs, ...rest } = dto;
    const data: Prisma.ProductUncheckedUpdateInput = { ...rest };
    if (specs !== undefined) data.specs = specs as Prisma.InputJsonValue;
    if (dto.status === 'published') data.publishedAt = new Date();
    const product = await this.prisma.product.update({ where: { id }, data });
    this.events.emit(CatalogEvents.ProductChanged, { productId: id });
    return product;
  }

  /** Soft delete. */
  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
    this.events.emit(CatalogEvents.ProductDeleted, { productId: id });
    return { success: true };
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!found) throw new NotFoundException(`Product '${id}' not found`);
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
