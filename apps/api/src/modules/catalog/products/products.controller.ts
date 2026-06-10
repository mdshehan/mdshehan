import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(
    @Query('brand') brand?: string,
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('price_min') priceMin?: string,
    @Query('price_max') priceMax?: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.products.list({
      brand,
      category,
      q,
      priceMin: priceMin ? Number(priceMin) : undefined,
      priceMax: priceMax ? Number(priceMax) : undefined,
      sort,
      limit: limit ? Number(limit) : undefined,
      cursor,
    });
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.products.getBySlug(slug);
  }

  @Get(':slug/prices')
  getPrices(@Param('slug') slug: string, @Query('country') country?: string) {
    return this.products.getPrices(slug, country ?? 'US');
  }
}
