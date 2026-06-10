import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AffiliateLinksService } from './affiliate-links.service';
import { ClickTrackingService } from './click-tracking.service';

/**
 * Affiliate redirect — mounted at the root (excluded from the /v1 prefix).
 * Latency-critical: resolve → 302 immediately, record the click asynchronously.
 */
@Controller('go')
export class RedirectController {
  constructor(
    private readonly links: AffiliateLinksService,
    private readonly clicks: ClickTrackingService,
  ) {}

  @Get(':code')
  async go(@Param('code') code: string, @Req() req: Request, @Res() res: Response) {
    const link = await this.links.resolve(code);
    if (!link) {
      res.status(404).send('Link not found');
      return;
    }

    // Fire-and-forget click tracking — never blocks the redirect.
    this.clicks.record({
      affiliateLinkId: link.id,
      productId: link.productId,
      storeId: link.storeId,
      countryId: link.countryId,
      sessionId: req.cookies?.sid,
      referrer: req.headers.referer,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.redirect(302, this.links.buildTargetUrl(link));
  }
}
