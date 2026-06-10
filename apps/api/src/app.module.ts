import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { AffiliateModule } from './modules/affiliate/affiliate.module';
import { SearchModule } from './modules/search/search.module';
import { StoresModule } from './modules/stores/stores.module';
import { LocalizationModule } from './modules/localization/localization.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    CatalogModule,
    PricingModule,
    AffiliateModule,
    SearchModule,
    StoresModule,
    LocalizationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
