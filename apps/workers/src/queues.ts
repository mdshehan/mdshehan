import { Queue, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';

/** Shared Redis connection. BullMQ requires maxRetriesPerRequest: null. */
export const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const QUEUES = {
  priceIngest: 'price-ingest',
  fxRates: 'fx-rates',
  sitemap: 'sitemap',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

const defaultJobOptions: QueueOptions['defaultJobOptions'] = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { count: 1_000 },
  removeOnFail: { count: 5_000 },
};

export const queues = {
  priceIngest: new Queue(QUEUES.priceIngest, { connection, defaultJobOptions }),
  fxRates: new Queue(QUEUES.fxRates, { connection, defaultJobOptions }),
  sitemap: new Queue(QUEUES.sitemap, { connection, defaultJobOptions }),
};

// ----- Job payload contracts -----
export interface PriceIngestJob {
  // A normalized merchant feed row. In production this comes from a feed parser
  // (Amazon PA-API, CSV/XML feeds, crawlers) — the shape the worker upserts.
  productSlug: string;
  storeSlug: string;
  countryIso: string;
  currencyCode: string;
  price: number;
  listPrice?: number;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
  productUrl?: string;
}

export interface SitemapJob {
  shardSize?: number;
}
