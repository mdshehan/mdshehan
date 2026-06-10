import { Worker } from 'bullmq';
import { connection, queues, QUEUES } from './queues';
import { processPriceIngest } from './jobs/price-ingest';
import { processFxRates } from './jobs/fx-rates';
import { processSitemap } from './jobs/sitemap';
import { prisma } from './prisma';

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);

function log(scope: string, msg: string) {
  console.log(`[${new Date().toISOString()}] ${scope}: ${msg}`);
}

async function registerSchedulers() {
  // Repeatable jobs are idempotent by jobId — safe to re-add on every boot.
  await queues.fxRates.add('refresh', {}, { repeat: { pattern: '0 * * * *' }, jobId: 'fx-hourly' });
  await queues.sitemap.add('rebuild', {}, { repeat: { pattern: '0 3 * * *' }, jobId: 'sitemap-nightly' });
  log('scheduler', 'registered fx (hourly) + sitemap (nightly 03:00)');
}

function startWorkers(): Worker[] {
  const priceWorker = new Worker(QUEUES.priceIngest, (job) => processPriceIngest(job), {
    connection,
    concurrency: CONCURRENCY,
  });
  const fxWorker = new Worker(QUEUES.fxRates, () => processFxRates(), { connection });
  const sitemapWorker = new Worker(QUEUES.sitemap, (job) => processSitemap(job), { connection });

  const workers = [priceWorker, fxWorker, sitemapWorker];
  for (const w of workers) {
    w.on('completed', (job, result) =>
      log(w.name, `job ${job.id} ✓ ${JSON.stringify(result)}`),
    );
    w.on('failed', (job, err) => log(w.name, `job ${job?.id} ✗ ${err.message}`));
  }
  return workers;
}

async function main() {
  log('boot', `connecting workers (concurrency=${CONCURRENCY})`);
  const workers = startWorkers();
  await registerSchedulers();
  log('boot', 'workers online — waiting for jobs');

  const shutdown = async () => {
    log('shutdown', 'draining workers…');
    await Promise.all(workers.map((w) => w.close()));
    await connection.quit();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('worker bootstrap failed', err);
  process.exit(1);
});
