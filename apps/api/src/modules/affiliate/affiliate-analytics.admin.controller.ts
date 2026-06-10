import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AffiliateAnalyticsService } from './affiliate-analytics.service';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('admin/affiliate')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AffiliateAnalyticsAdminController {
  constructor(private readonly analytics: AffiliateAnalyticsService) {}

  @Get('analytics')
  @Permissions('affiliate.view')
  overview(@Query('days') days?: string) {
    return this.analytics.overview(days ? Number(days) : 30);
  }
}
