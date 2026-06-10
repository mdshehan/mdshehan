/**
 * Dev helper to enqueue jobs manually:
 *   pnpm --filter @ggph/workers enqueue fx
 *   pnpm --filter @ggph/workers enqueue sitemap
 *   pnpm --filter @ggph/workers enqueue price samsung-galaxy-s25-ultra amazon US USD 1149
 */
import { queues, connection } from '../queues';

async function main() {
  const [, , kind, ...args] = process.argv;

  switch (kind) {
    case 'fx':
      await queues.fxRates.add('refresh', {});
      console.log('enqueued fx-rates refresh');
      break;
    case 'sitemap':
      await queues.sitemap.add('rebuild', {});
      console.log('enqueued sitemap rebuild');
      break;
    case 'price': {
      const [productSlug, storeSlug, countryIso, currencyCode, price] = args;
      if (!productSlug || !storeSlug || !countryIso || !currencyCode || !price) {
        console.error('usage: enqueue price <productSlug> <storeSlug> <countryIso> <currencyCode> <price>');
        process.exit(1);
      }
      await queues.priceIngest.add('ingest', {
        productSlug,
        storeSlug,
        countryIso,
        currencyCode,
        price: Number(price),
      });
      console.log(`enqueued price-ingest for ${productSlug}`);
      break;
    }
    default:
      console.error('unknown job kind. use: fx | sitemap | price');
      process.exit(1);
  }

  await connection.quit();
  process.exit(0);
}

main();
