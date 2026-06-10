import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MeiliSearch, Index } from 'meilisearch';

export const PRODUCTS_INDEX = 'products';

export interface ProductDoc {
  id: string;
  name: string;
  slug: string;
  brandName: string;
  brandSlug: string;
  categoryName: string;
  categorySlug: string;
  ram?: number;
  storage?: number;
  screenSize?: number;
  battery?: number;
  chipset?: string;
  priceUsd: number | null;
  ratingAvg: number;
  availability: string;
  isFeatured: boolean;
  releaseTs: number | null;
  image?: string | null;
}

@Injectable()
export class MeiliService implements OnModuleInit {
  private readonly logger = new Logger(MeiliService.name);
  private client: MeiliSearch | null = null;
  private available = false;

  get isAvailable() {
    return this.available;
  }

  async onModuleInit() {
    try {
      this.client = new MeiliSearch({
        host: process.env.MEILI_HOST ?? 'http://localhost:7700',
        apiKey: process.env.MEILI_MASTER_KEY,
      });
      await this.client.health();
      await this.ensureIndex();
      this.available = true;
      this.logger.log('Meilisearch connected and index configured');
    } catch (err) {
      this.available = false;
      this.logger.warn(
        `Meilisearch unavailable (${(err as Error).message}). Search falls back to Postgres.`,
      );
    }
  }

  index(): Index<ProductDoc> {
    if (!this.client) throw new Error('Meilisearch client not initialized');
    return this.client.index<ProductDoc>(PRODUCTS_INDEX);
  }

  private async ensureIndex() {
    if (!this.client) return;
    await this.client.createIndex(PRODUCTS_INDEX, { primaryKey: 'id' }).catch(() => undefined);
    await this.index().updateSettings({
      searchableAttributes: ['name', 'brandName', 'categoryName', 'chipset'],
      filterableAttributes: [
        'brandSlug',
        'categorySlug',
        'ram',
        'storage',
        'priceUsd',
        'availability',
        'isFeatured',
      ],
      sortableAttributes: ['priceUsd', 'ratingAvg', 'releaseTs'],
      rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
    });
  }
}
