import { Job } from 'bullmq';
import { AvailabilityStatus } from '@prisma/client';
import { prisma } from '../prisma';
import type { PriceIngestJob } from '../queues';

/**
 * Ingest one normalized merchant feed row → upsert the offer, append price
 * history, recompute the product's best price. Idempotent: re-running the same
 * feed row converges to the same state (unique offer key + append-only history).
 *
 * In production the API's PricesService logic would live in a shared package so
 * the worker and API stay byte-identical; here it's reimplemented directly.
 */
export async function processPriceIngest(job: Job<PriceIngestJob>) {
  const data = job.data;

  const [product, store, country, currency] = await Promise.all([
    prisma.product.findFirst({ where: { slug: data.productSlug }, select: { id: true } }),
    prisma.store.findUnique({ where: { slug: data.storeSlug }, select: { id: true } }),
    prisma.country.findUnique({ where: { iso2: data.countryIso }, select: { id: true } }),
    prisma.currency.findUnique({ where: { code: data.currencyCode } }),
  ]);

  if (!product || !store || !country || !currency) {
    throw new Error(
      `Unresolved refs for ${data.productSlug} @ ${data.storeSlug}/${data.countryIso}`,
    );
  }

  const availability = (data.availability ?? 'in_stock') as AvailabilityStatus;
  const priceUsd = Number((data.price * Number(currency.usdRate)).toFixed(2));

  const offer = await prisma.price.upsert({
    where: {
      productId_variantId_storeId_countryId: {
        productId: product.id,
        variantId: null as unknown as string,
        storeId: store.id,
        countryId: country.id,
      },
    },
    update: {
      price: data.price,
      priceUsd,
      listPrice: data.listPrice,
      availability,
      productUrl: data.productUrl,
      lastCheckedAt: new Date(),
    },
    create: {
      productId: product.id,
      storeId: store.id,
      countryId: country.id,
      currencyId: currency.id,
      price: data.price,
      priceUsd,
      listPrice: data.listPrice,
      availability,
      productUrl: data.productUrl,
    },
  });

  await prisma.priceHistory.create({
    data: {
      productId: product.id,
      storeId: store.id,
      countryId: country.id,
      price: offer.price,
      priceUsd: offer.priceUsd,
      availability,
    },
  });

  const agg = await prisma.price.aggregate({
    where: { productId: product.id, availability: 'in_stock' },
    _min: { priceUsd: true },
  });
  await prisma.product.update({
    where: { id: product.id },
    data: { minPriceUsd: agg._min.priceUsd ?? null },
  });

  return { productId: product.id, priceUsd };
}
