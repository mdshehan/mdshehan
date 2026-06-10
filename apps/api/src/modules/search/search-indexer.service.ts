import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { MeiliService, ProductDoc } from './meili.service';
import {
  CatalogEvents,
  ProductChangedEvent,
  ProductDeletedEvent,
} from '../../common/events/catalog.events';

@Injectable()
export class SearchIndexerService {
  private readonly logger = new Logger(SearchIndexerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meili: MeiliService,
  ) {}

  @OnEvent(CatalogEvents.ProductChanged)
  async onProductChanged(payload: ProductChangedEvent) {
    await this.indexOne(payload.productId).catch((e) =>
      this.logger.warn(`index ${payload.productId} failed: ${(e as Error).message}`),
    );
  }

  @OnEvent(CatalogEvents.ProductDeleted)
  async onProductDeleted(payload: ProductDeletedEvent) {
    if (!this.meili.isAvailable) return;
    await this.meili
      .index()
      .deleteDocument(payload.productId)
      .catch((e) => this.logger.warn(`delete doc failed: ${(e as Error).message}`));
  }

  /** Index a single product (no-op if Meili is down — re-synced on next reindex). */
  async indexOne(productId: string) {
    if (!this.meili.isAvailable) return;
    const doc = await this.buildDoc(productId);
    if (doc) await this.meili.index().addDocuments([doc]);
  }

  /** Full rebuild — used by the admin reindex endpoint / nightly job. */
  async reindexAll(): Promise<{ indexed: number; skipped: boolean }> {
    if (!this.meili.isAvailable) return { indexed: 0, skipped: true };
    const products = await this.prisma.product.findMany({
      where: { status: 'published', deletedAt: null },
      include: { brand: true, category: true },
    });
    const docs = products.map((p) => this.toDoc(p));
    if (docs.length) await this.meili.index().addDocuments(docs);
    return { indexed: docs.length, skipped: false };
  }

  private async buildDoc(productId: string): Promise<ProductDoc | null> {
    const p = await this.prisma.product.findFirst({
      where: { id: productId, status: 'published', deletedAt: null },
      include: { brand: true, category: true },
    });
    return p ? this.toDoc(p) : null;
  }

  private toDoc(p: {
    id: string;
    name: string;
    slug: string;
    specs: unknown;
    ratingAvg: unknown;
    minPriceUsd: unknown;
    availability: string;
    isFeatured: boolean;
    releaseDate: Date | null;
    brand: { name: string; slug: string };
    category: { name: string; slug: string };
  }): ProductDoc {
    const specs = (p.specs ?? {}) as Record<string, unknown>;
    const num = (v: unknown) => (v === undefined || v === null ? undefined : Number(v));
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      brandName: p.brand.name,
      brandSlug: p.brand.slug,
      categoryName: p.category.name,
      categorySlug: p.category.slug,
      ram: num(specs.ram),
      storage: num(specs.storage),
      screenSize: num(specs.screen_size),
      battery: num(specs.battery_mah),
      chipset: typeof specs.chipset === 'string' ? specs.chipset : undefined,
      priceUsd: p.minPriceUsd === null ? null : Number(p.minPriceUsd),
      ratingAvg: Number(p.ratingAvg),
      availability: p.availability,
      isFeatured: p.isFeatured,
      releaseTs: p.releaseDate ? p.releaseDate.getTime() : null,
    };
  }
}
