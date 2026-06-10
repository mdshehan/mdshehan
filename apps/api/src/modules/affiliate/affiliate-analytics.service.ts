import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AffiliateAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(days = 30) {
    const since = new Date(Date.now() - days * 86400_000);
    const where = { clickedAt: { gte: since } };

    const [clicks, agg, conversions, byStore, byCountry, byDevice] = await Promise.all([
      this.prisma.affiliateClick.count({ where }),
      this.prisma.affiliateClick.aggregate({ where, _sum: { revenueUsd: true } }),
      this.prisma.affiliateClick.count({ where: { ...where, converted: true } }),
      this.prisma.affiliateClick.groupBy({
        by: ['storeId'],
        where,
        _count: { _all: true },
        _sum: { revenueUsd: true },
      }),
      this.prisma.affiliateClick.groupBy({
        by: ['countryId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.affiliateClick.groupBy({
        by: ['device'],
        where,
        _count: { _all: true },
      }),
    ]);

    const revenue = Number(agg._sum.revenueUsd ?? 0);
    return {
      rangeDays: days,
      clicks,
      revenueUsd: revenue,
      conversions,
      epc: clicks ? Number((revenue / clicks).toFixed(4)) : 0, // earnings per click
      conversionRate: clicks ? Number((conversions / clicks).toFixed(4)) : 0,
      // CTR (clicks / impressions) requires buy-button impression tracking — wired in the ads/beacon step.
      ctr: null,
      byStore: byStore.map((s) => ({
        storeId: s.storeId,
        clicks: s._count._all,
        revenueUsd: Number(s._sum.revenueUsd ?? 0),
      })),
      byCountry: byCountry.map((c) => ({ countryId: c.countryId, clicks: c._count._all })),
      byDevice: byDevice.map((d) => ({ device: d.device, clicks: d._count._all })),
    };
  }
}
