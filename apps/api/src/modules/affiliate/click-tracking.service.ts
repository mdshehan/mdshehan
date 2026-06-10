import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface ClickContext {
  affiliateLinkId: string;
  productId?: string | null;
  storeId?: string | null;
  countryId?: string | null;
  userId?: string | null;
  sessionId?: string;
  referrer?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class ClickTrackingService {
  private readonly logger = new Logger(ClickTrackingService.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fire-and-forget click recording. Never blocks the redirect; failures are
   * logged, not thrown. In production this enqueues to BullMQ → ClickHouse.
   */
  record(ctx: ClickContext): void {
    void this.persist(ctx).catch((err) =>
      this.logger.warn(`click record failed: ${(err as Error).message}`),
    );
  }

  private async persist(ctx: ClickContext) {
    await this.prisma.affiliateClick.create({
      data: {
        affiliateLinkId: ctx.affiliateLinkId,
        productId: ctx.productId ?? undefined,
        storeId: ctx.storeId ?? undefined,
        countryId: ctx.countryId ?? undefined,
        userId: ctx.userId ?? undefined,
        sessionId: ctx.sessionId,
        device: this.detectDevice(ctx.userAgent),
        referrer: ctx.referrer,
        ipHash: ctx.ip ? this.hashIp(ctx.ip) : undefined,
        userAgent: ctx.userAgent,
      },
    });
  }

  private detectDevice(ua?: string): string {
    if (!ua) return 'all';
    if (/tablet|ipad/i.test(ua)) return 'tablet';
    if (/mobi|android|iphone/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  private hashIp(ip: string): string {
    const salt = process.env.IP_HASH_SALT ?? 'ggph';
    return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
  }
}
