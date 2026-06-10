import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAffiliateLinkDto, UpdateAffiliateLinkDto } from './affiliate.dto';

@Injectable()
export class AffiliateLinksService {
  constructor(private readonly prisma: PrismaService) {}

  list(productId?: string) {
    return this.prisma.affiliateLink.findMany({
      where: { ...(productId ? { productId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { store: true },
    });
  }

  async create(dto: CreateAffiliateLinkDto) {
    const shortCode = dto.shortCode ?? (await this.uniqueShortCode());
    const clash = await this.prisma.affiliateLink.findUnique({ where: { shortCode } });
    if (clash) throw new ConflictException(`Short code '${shortCode}' already in use`);
    return this.prisma.affiliateLink.create({ data: { ...dto, shortCode } });
  }

  async update(id: string, dto: UpdateAffiliateLinkDto) {
    await this.ensureExists(id);
    return this.prisma.affiliateLink.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.affiliateLink.delete({ where: { id } });
    return { success: true };
  }

  /** Resolve a short code to an active link for redirecting. */
  resolve(code: string) {
    return this.prisma.affiliateLink.findFirst({
      where: { shortCode: code, isActive: true },
    });
  }

  /**
   * Build the final merchant URL with affiliate tag + sub-id appended.
   * Uses the store deeplink template if present, else query params on targetUrl.
   */
  buildTargetUrl(link: {
    targetUrl: string;
    affiliateTag: string | null;
    subId: string | null;
  }): string {
    try {
      const url = new URL(link.targetUrl);
      if (link.affiliateTag) url.searchParams.set('tag', link.affiliateTag);
      if (link.subId) url.searchParams.set('subid', link.subId);
      return url.toString();
    } catch {
      return link.targetUrl;
    }
  }

  private async uniqueShortCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = randomBytes(6).toString('base64url').slice(0, 8);
      const exists = await this.prisma.affiliateLink.findUnique({ where: { shortCode: code } });
      if (!exists) return code;
    }
    return randomBytes(9).toString('base64url').slice(0, 12);
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.affiliateLink.findUnique({ where: { id } });
    if (!found) throw new NotFoundException(`Affiliate link '${id}' not found`);
  }
}
