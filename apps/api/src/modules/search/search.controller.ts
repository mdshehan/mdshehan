import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  query(
    @Query('q') q?: string,
    @Query('brand') brand?: string,
    @Query('category') category?: string,
    @Query('price_min') priceMin?: string,
    @Query('price_max') priceMax?: string,
    @Query('ram') ram?: string,
    @Query('storage') storage?: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.search.search({
      q,
      brand,
      category,
      priceMin: priceMin ? Number(priceMin) : undefined,
      priceMax: priceMax ? Number(priceMax) : undefined,
      ram: ram ? Number(ram) : undefined,
      storage: storage ? Number(storage) : undefined,
      sort,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('autocomplete')
  autocomplete(@Query('q') q = '') {
    return this.search.autocomplete(q);
  }
}
