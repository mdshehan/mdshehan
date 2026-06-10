import { Module } from '@nestjs/common';
import { AffiliateLinksService } from './affiliate-links.service';
import { ClickTrackingService } from './click-tracking.service';
import { AffiliateAnalyticsService } from './affiliate-analytics.service';
import { RedirectController } from './redirect.controller';
import { AffiliateLinksAdminController } from './affiliate-links.admin.controller';
import { AffiliateAnalyticsAdminController } from './affiliate-analytics.admin.controller';

@Module({
  controllers: [
    RedirectController,
    AffiliateLinksAdminController,
    AffiliateAnalyticsAdminController,
  ],
  providers: [AffiliateLinksService, ClickTrackingService, AffiliateAnalyticsService],
})
export class AffiliateModule {}
