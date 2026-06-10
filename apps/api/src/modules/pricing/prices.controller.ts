import { Controller, Get, Param, Query } from '@nestjs/common';
import { PricesService } from './prices.service';

/** Public price-history endpoint (powers the product price chart). */
@Controller('products')
export class PriceHistoryController {
  constructor(private readonly prices: PricesService) {}

  @Get(':slug/price-history')
  history(
    @Param('slug') slug: string,
    @Query('days') days?: string,
    @Query('store') store?: string,
  ) {
    return this.prices.getHistory(slug, days ? Number(days) : 180, store);
  }
}
