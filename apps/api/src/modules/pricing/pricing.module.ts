import { Module } from '@nestjs/common';
import { PricesService } from './prices.service';
import { PriceHistoryController } from './prices.controller';
import { PricesAdminController } from './prices.admin.controller';

@Module({
  controllers: [PriceHistoryController, PricesAdminController],
  providers: [PricesService],
})
export class PricingModule {}
