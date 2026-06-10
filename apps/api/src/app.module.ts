import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { CatalogModule } from './modules/catalog/catalog.module';
import { LocalizationModule } from './modules/localization/localization.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CatalogModule,
    LocalizationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
