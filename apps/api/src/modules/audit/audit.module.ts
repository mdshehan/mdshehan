import { Controller, Get, Module, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('admin/activity-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class ActivityLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Permissions('user.view')
  list(@Query('limit') limit?: string, @Query('subject') subjectType?: string) {
    return this.prisma.activityLog.findMany({
      where: subjectType ? { subjectType } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit ?? 100), 500),
    });
  }
}

@Module({
  controllers: [ActivityLogsController],
})
export class AuditModule {}
