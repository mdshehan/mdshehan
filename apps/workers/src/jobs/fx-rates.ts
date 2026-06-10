import { prisma } from '../prisma';

// Fallback rates (1 unit = X USD) used when no live FX provider is configured
// or the request fails — keeps prices sane rather than zeroing out.
const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  BDT: 0.0091,
  INR: 0.012,
};

interface FxResponse {
  rates: Record<string, number>; // USD-based: 1 USD = rates[CODE] of that currency
}

async function fetchRates(): Promise<Record<string, number> | null> {
  const endpoint = process.env.FX_API_URL; // e.g. https://api.exchangerate.host/latest?base=USD
  if (!endpoint) return null;
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const body = (await res.json()) as FxResponse;
    // Convert "1 USD = N CUR" → "1 CUR = 1/N USD"
    const usdRates: Record<string, number> = {};
    for (const [code, perUsd] of Object.entries(body.rates ?? {})) {
      if (perUsd > 0) usdRates[code] = 1 / perUsd;
    }
    return usdRates;
  } catch {
    return null;
  }
}

/** Refresh currencies.usd_rate for all active currencies. */
export async function processFxRates() {
  const live = await fetchRates();
  const rates = live ?? FALLBACK_USD_RATES;
  const source = live ? 'live' : 'fallback';

  const currencies = await prisma.currency.findMany({ where: { isActive: true } });
  let updated = 0;
  for (const c of currencies) {
    const rate = rates[c.code];
    if (rate === undefined) continue;
    await prisma.currency.update({
      where: { id: c.id },
      data: { usdRate: rate, rateUpdatedAt: new Date() },
    });
    updated++;
  }
  return { source, updated };
}
